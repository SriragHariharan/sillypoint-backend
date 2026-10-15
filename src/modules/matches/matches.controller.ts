import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type TournamentIdParams } from "../tournaments/tournaments.schema.js"
import { MATCH_CREATED, MATCH_RESCHEDULED } from "./matches.constants.js"
import { type CreateMatchInput, type MatchIdParams, type RescheduleMatchInput } from "./matches.schema.js"
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

// Public details of one match
export const details = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as MatchIdParams
    const match = await matchService.getMatch(id)
    return success(res, { match })
}

// Move a match to a new date and time (organizer only)
export const reschedule = async (req: Request, res: Response) => {
    const { id } = res.locals.params as MatchIdParams
    const match = await matchService.rescheduleMatch(res.locals.userId as number, id, req.body as RescheduleMatchInput)
    return success(res, { message: MATCH_RESCHEDULED, match })
}
