import { BadRequestError, ConflictError, ForbiddenError } from "../../shared/http/errors.js"
import { areTeamsEnrolled, getTournament } from "../tournaments/tournaments.service.js"
import { NOT_ORGANIZER } from "../tournaments/tournaments.constants.js"
import {
    DATE_OUTSIDE_TOURNAMENT,
    MATCH_IN_PAST,
    MATCH_TIMEZONE_OFFSET,
    TEAM_NOT_IN_TOURNAMENT,
    TOURNAMENT_NOT_OPEN,
} from "./matches.constants.js"
import { findMatch, insertMatch, listTournamentMatches } from "./matches.repository.js"
import { type CreateMatchInput } from "./matches.schema.js"

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
