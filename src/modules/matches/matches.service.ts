import { randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    TooManyRequestsError,
    UnauthorizedError,
} from "../../shared/http/errors.js"
import { signScorerToken } from "../../shared/utils/jwt.js"
import { areTeamsEnrolled, getTournament } from "../tournaments/tournaments.service.js"
import { NOT_ORGANIZER } from "../tournaments/tournaments.constants.js"
import {
    DATE_OUTSIDE_TOURNAMENT,
    MATCH_ALREADY_STARTED,
    MATCH_IN_PAST,
    MATCH_NOT_FOUND,
    MATCH_TIMEZONE_OFFSET,
    NO_SCORER,
    SCORER_ALREADY_ADDED,
    SCORER_INVALID_LOGIN,
    SCORER_LINK_TOKEN_BYTES,
    SCORER_LOCK_MS,
    SCORER_LOCKED,
    SCORER_PIN_LENGTH,
    SCORER_TOKEN_TTL_SECONDS,
    TEAM_NOT_IN_TOURNAMENT,
    TOURNAMENT_NOT_OPEN,
    TOURNAMENT_NOT_OPEN_FOR_RESCHEDULE,
    TOURNAMENT_NOT_OPEN_FOR_SCORER,
    TOURNAMENT_NOT_OPEN_FOR_SCORER_LOGIN,
} from "./matches.constants.js"
import {
    clearScorerLoginFailures,
    findMatch,
    findScorerAccess,
    findScorerLogin,
    insertMatch,
    listTournamentMatches,
    recordScorerLoginFailure,
    type ScorerAccess,
    setMatchScorer,
    setScorerAccess,
    updateMatchSchedule,
} from "./matches.repository.js"
import {
    type AddScorerInput,
    type CreateMatchInput,
    type RescheduleMatchInput,
    type ScorerLoginInput,
} from "./matches.schema.js"

// Schedule a match between two enrolled teams. Only the tournament's organizer can.
export const createMatch = async (userId: number, tournamentId: number, input: CreateMatchInput) => {
    const tournament = await getTournament(tournamentId)

    if (tournament.organizer.id !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (tournament.status === "cancelled" || tournament.status === "completed") {
        throw new ConflictError(TOURNAMENT_NOT_OPEN)
    }
    if (input.matchDate < tournament.startDate || input.matchDate > tournament.endDate) {
        throw new BadRequestError(DATE_OUTSIDE_TOURNAMENT)
    }

    const scheduledAt = new Date(`${input.matchDate}T${input.matchTime}:00${MATCH_TIMEZONE_OFFSET}`)
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestError(MATCH_IN_PAST)

    const enrolled = await areTeamsEnrolled(tournamentId, [input.teamAId, input.teamBId])
    if (!enrolled) throw new BadRequestError(TEAM_NOT_IN_TOURNAMENT)

    const created = await insertMatch({
        tournamentId,
        teamAId: input.teamAId,
        teamBId: input.teamBId,
        scheduledAt,
        stage: input.stage ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
    })
    if (!created) throw new Error("Failed to create match")

    return findMatch(created.id)
}

// Public list of a tournament's matches
export const listMatches = async (tournamentId: number) => {
    await getTournament(tournamentId)
    return listTournamentMatches(tournamentId)
}

// One match with its teams and the tournament it belongs to
const matchWithTournament = async (id: number) => {
    const match = await findMatch(id)
    if (!match) throw new NotFoundError(MATCH_NOT_FOUND)

    const tournament = await getTournament(match.tournamentId)
    return {
        match: {
            ...match,
            tournament: {
                id: tournament.id,
                name: tournament.name,
                logo: tournament.logo,
                location: tournament.location,
                startDate: tournament.startDate,
                endDate: tournament.endDate,
                status: tournament.status,
                organizerId: tournament.organizerId,
            },
        },
        tournament,
    }
}

// Public details of one match
export const getMatch = async (id: number) => (await matchWithTournament(id)).match

// Move a match to a new date and time. Only the tournament's organizer can, and only before it starts.
export const rescheduleMatch = async (userId: number, id: number, input: RescheduleMatchInput) => {
    const { match, tournament } = await matchWithTournament(id)

    if (tournament.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (tournament.status === "cancelled" || tournament.status === "completed") {
        throw new ConflictError(TOURNAMENT_NOT_OPEN_FOR_RESCHEDULE)
    }
    if (match.scheduledAt.getTime() <= Date.now()) throw new ConflictError(MATCH_ALREADY_STARTED)
    if (input.matchDate < tournament.startDate || input.matchDate > tournament.endDate) {
        throw new BadRequestError(DATE_OUTSIDE_TOURNAMENT)
    }

    const scheduledAt = new Date(`${input.matchDate}T${input.matchTime}:00${MATCH_TIMEZONE_OFFSET}`)
    if (scheduledAt.getTime() <= Date.now()) throw new BadRequestError(MATCH_IN_PAST)

    const updated = await updateMatchSchedule(id, scheduledAt)
    if (!updated) throw new NotFoundError(MATCH_NOT_FOUND)

    return getMatch(id)
}

// Assign the match's one scorer. Only the tournament's organizer can, while the tournament is open.
export const addScorer = async (userId: number, id: number, input: AddScorerInput) => {
    const { tournament } = await matchWithTournament(id)

    if (tournament.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (tournament.status === "cancelled" || tournament.status === "completed") {
        throw new ConflictError(TOURNAMENT_NOT_OPEN_FOR_SCORER)
    }

    const updated = await setMatchScorer(id, input.name, input.mobile, newScorerAccess())
    if (!updated) throw new ConflictError(SCORER_ALREADY_ADDED)

    return getMatch(id)
}

// A new random login link token and a 6-digit PIN like 004217
const newScorerAccess = (): ScorerAccess => ({
    linkToken: randomBytes(SCORER_LINK_TOKEN_BYTES).toString("base64url"),
    pin: randomInt(0, 10 ** SCORER_PIN_LENGTH)
        .toString()
        .padStart(SCORER_PIN_LENGTH, "0"),
})

// Compare two strings without leaking where they differ
const sameText = (a: string, b: string) => {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
}

// The scorer's login link token and PIN, for the organizer to share. A scorer added before links existed gets them now.
export const getScorerAccess = async (userId: number, id: number): Promise<ScorerAccess> => {
    const { tournament } = await matchWithTournament(id)
    if (tournament.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)

    const row = await findScorerAccess(id)
    if (!row?.scorerName) throw new NotFoundError(NO_SCORER)
    if (row.linkToken && row.pin) return { linkToken: row.linkToken, pin: row.pin }

    const access = newScorerAccess()
    if (await setScorerAccess(id, access)) return access

    // Another request filled it first: use theirs
    const filled = await findScorerAccess(id)
    if (!filled?.linkToken || !filled.pin) throw new NotFoundError(NO_SCORER)
    return { linkToken: filled.linkToken, pin: filled.pin }
}

// Log a scorer in with the match's link token, their mobile and the PIN. Wrong tries lock the login for a while.
export const scorerLogin = async (input: ScorerLoginInput) => {
    const row = await findScorerLogin(input.token)
    if (!row?.mobile || !row.pin) throw new UnauthorizedError(SCORER_INVALID_LOGIN)

    if (row.lockedUntil && row.lockedUntil > new Date()) {
        const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60000))
        throw new TooManyRequestsError(`${SCORER_LOCKED} ${minutes} minutes`)
    }

    if (!sameText(row.mobile, input.mobile) || !sameText(row.pin, input.pin)) {
        await recordScorerLoginFailure(row.id, new Date(Date.now() + SCORER_LOCK_MS))
        throw new UnauthorizedError(SCORER_INVALID_LOGIN)
    }

    const tournament = await getTournament(row.tournamentId)
    if (tournament.status === "cancelled" || tournament.status === "completed") {
        throw new ConflictError(TOURNAMENT_NOT_OPEN_FOR_SCORER_LOGIN)
    }

    await clearScorerLoginFailures(row.id)
    return {
        accessToken: signScorerToken(row.id, SCORER_TOKEN_TTL_SECONDS),
        scorer: { name: row.scorerName },
        match: await getMatch(row.id),
    }
}
