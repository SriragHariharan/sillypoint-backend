import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type CreateTeamInput, type TeamIdParams, type UpdateTeamInput } from "./teams.schema.js"
import * as teamService from "./teams.service.js"

// Create a team managed by the logged in user
export const create = async (req: Request, res: Response) => {
    const team = await teamService.createTeam(res.locals.userId as number, req.body as CreateTeamInput, req.file)
    return success(res, team, 201)
}

// Teams managed by the logged in user
export const list = async (_req: Request, res: Response) => {
    const teams = await teamService.listMyTeams(res.locals.userId as number)
    return success(res, teams)
}

// One team managed by the logged in user
export const details = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as TeamIdParams
    const team = await teamService.getMyTeam(res.locals.userId as number, id)
    return success(res, team)
}

// Update a team managed by the logged in user
export const update = async (req: Request, res: Response) => {
    const { id } = res.locals.params as TeamIdParams
    const team = await teamService.updateMyTeam(res.locals.userId as number, id, req.body as UpdateTeamInput, req.file)
    return success(res, team)
}
