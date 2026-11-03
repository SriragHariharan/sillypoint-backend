import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { SQUADS_SAVED } from "./squads.constants.js"
import { type SaveSquadsInput } from "./squads.schema.js"
import * as squadService from "./squads.service.js"

// Both teams' players for the scorer's match
export const list = async (_req: Request, res: Response) => {
    const squads = await squadService.getSquads(res.locals.matchId as number)
    return success(res, squads)
}

// Save both teams' players (scorer token)
export const save = async (req: Request, res: Response) => {
    const squads = await squadService.saveSquads(res.locals.matchId as number, req.body as SaveSquadsInput)
    return success(res, { message: SQUADS_SAVED, ...squads })
}
