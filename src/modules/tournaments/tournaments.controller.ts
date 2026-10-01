import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import {
    type AddTeamsInput,
    type CreateTournamentInput,
    type EnrolledTeamParams,
    type ListTournamentsQuery,
    type RescheduleTournamentInput,
    type TournamentIdParams,
} from "./tournaments.schema.js"
import { TEAM_REMOVED, TEAMS_ADDED, TOURNAMENT_RESCHEDULED } from "./tournaments.constants.js"
import * as tournamentService from "./tournaments.service.js"

// Create a tournament for the logged in user
export const create = async (req: Request, res: Response) => {
    const tournament = await tournamentService.createTournament(
        res.locals.userId as number,
        req.body as CreateTournamentInput,
        req.file,
    )
    return success(res, { message: "Tournament created", tournament }, 201)
}

// Cancel a tournament (organizer only)
export const cancel = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const tournament = await tournamentService.cancelTournament(res.locals.userId as number, id)
    return success(res, { message: "Tournament cancelled", tournament })
}

// Move a tournament to new dates (organizer only)
export const reschedule = async (req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const tournament = await tournamentService.rescheduleTournament(
        res.locals.userId as number,
        id,
        req.body as RescheduleTournamentInput,
    )
    return success(res, { message: TOURNAMENT_RESCHEDULED, tournament })
}

// List tournaments with filters
export const list = async (_req: Request, res: Response) => {
    const result = await tournamentService.listAllTournaments(res.locals.query as ListTournamentsQuery)
    return success(res, result)
}

// One tournament with its organizer
export const details = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const tournament = await tournamentService.getTournament(id)
    return success(res, { tournament })
}

// Add the logged in user's teams to a tournament
export const addTeams = async (req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const { team_ids } = req.body as AddTeamsInput
    const teams = await tournamentService.addTeamsToTournament(res.locals.userId as number, id, team_ids)
    return success(res, { message: TEAMS_ADDED, teams }, 201)
}

// Public list of the teams in a tournament
export const listTeams = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const teams = await tournamentService.listTeamsInTournament(id)
    return success(res, { teams })
}

// Remove a team from a tournament (organizer or the user who added it)
export const removeTeam = async (_req: Request, res: Response) => {
    const { id, teamId } = res.locals.params as EnrolledTeamParams
    await tournamentService.removeTeamFromTournament(res.locals.userId as number, id, teamId)
    return success(res, { message: TEAM_REMOVED })
}
