import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/http/errors.js"
import { areTeamsEnrolled, getTournament } from "../tournaments/tournaments.service.js"
import { NOT_ORGANIZER } from "../tournaments/tournaments.constants.js"
import {
    DATE_OUTSIDE_TOURNAMENT,
    MATCH_ALREADY_STARTED,
    MATCH_IN_PAST,
    MATCH_NOT_FOUND,
    MATCH_TIMEZONE_OFFSET,
    TEAM_NOT_IN_TOURNAMENT,
    TOURNAMENT_NOT_OPEN,
    TOURNAMENT_NOT_OPEN_FOR_RESCHEDULE,
} from "./matches.constants.js"
import { findMatch, insertMatch, listTournamentMatches, updateMatchSchedule } from "./matches.repository.js"
import { type CreateMatchInput, type RescheduleMatchInput } from "./matches.schema.js"

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
