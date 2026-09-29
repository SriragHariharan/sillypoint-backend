import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type CreateTournamentInput, type ListTournamentsQuery, type TournamentIdParams } from "./tournaments.schema.js"
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
