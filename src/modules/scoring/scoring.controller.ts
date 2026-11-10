import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type MatchIdParams } from "../matches/matches.schema.js"
import { INNINGS_STARTED } from "./scoring.constants.js"
import {
    type ChooseBatterInput,
    type ChooseBowlerInput,
    type InningsParams,
    type RecordBallInput,
    type RetireInput,
    type StartInningsInput,
    type VersionOnlyInput,
} from "./scoring.schema.js"
import * as scoringService from "./scoring.service.js"

const matchIdOf = (res: Response) => res.locals.matchId as number
const inningsOf = (res: Response) => (res.locals.params as InningsParams).n

// The scorer's resume state (scorer token)
export const state = async (_req: Request, res: Response) => {
    return success(res, await scoringService.getScoringState(matchIdOf(res)))
}

// Start the first or the second innings with the opening batters and bowler (scorer token)
export const start = async (req: Request, res: Response) => {
    const result = await scoringService.startInnings(matchIdOf(res), req.body as StartInningsInput)
    return success(res, { message: INNINGS_STARTED, ...result }, 201)
}

// Record one ball (scorer token)
export const ball = async (req: Request, res: Response) => {
    return success(res, await scoringService.recordBall(matchIdOf(res), inningsOf(res), req.body as RecordBallInput))
}

// Choose the next batter after a wicket (scorer token)
export const batter = async (req: Request, res: Response) => {
    return success(res, await scoringService.chooseBatter(matchIdOf(res), inningsOf(res), req.body as ChooseBatterInput))
}

// Choose the bowler of the next over (scorer token)
export const bowler = async (req: Request, res: Response) => {
    return success(res, await scoringService.chooseBowler(matchIdOf(res), inningsOf(res), req.body as ChooseBowlerInput))
}

// Change the batters' ends (scorer token)
export const swap = async (req: Request, res: Response) => {
    const { expectedVersion } = req.body as VersionOnlyInput
    return success(res, await scoringService.swapBatters(matchIdOf(res), inningsOf(res), expectedVersion))
}

// A batter retires (scorer token)
export const retire = async (req: Request, res: Response) => {
    return success(res, await scoringService.retireBatter(matchIdOf(res), inningsOf(res), req.body as RetireInput))
}

// Take back the last ball (scorer token)
export const undo = async (req: Request, res: Response) => {
    const { expectedVersion } = req.body as VersionOnlyInput
    return success(res, await scoringService.undoLast(matchIdOf(res), inningsOf(res), expectedVersion))
}

// End the innings (scorer token)
export const end = async (req: Request, res: Response) => {
    const { expectedVersion } = req.body as VersionOnlyInput
    return success(res, await scoringService.finishInnings(matchIdOf(res), inningsOf(res), expectedVersion))
}

// Public scorecard of a match
export const scorecard = async (_req: Request, res: Response) => {
    const { id } = res.locals.params as MatchIdParams
    return success(res, await scoringService.getScorecard(id))
}
