import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type TournamentIdParams } from "../tournaments/tournaments.schema.js"
import * as standingsService from "./standings.service.js"

// Public points table of a tournament
export const standings = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TournamentIdParams
    return success(res, { standings: await standingsService.getStandings(id) })
}
