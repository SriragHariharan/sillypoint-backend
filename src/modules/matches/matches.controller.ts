import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type TournamentIdParams } from "../tournaments/tournaments.schema.js"
import { MATCH_CREATED } from "./matches.constants.js"
import { type CreateMatchInput } from "./matches.schema.js"
import * as matchService from "./matches.service.js"

// Schedule a match in a tournament (organizer only)
export const create = async (req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const match = await matchService.createMatch(res.locals.userId as number, id, req.body as CreateMatchInput)
    return success(res, { message: MATCH_CREATED, match }, 201)
}

// Public list of the matches in a tournament
export const list = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    const matches = await matchService.listMatches(id)
    return success(res, { matches })
}
