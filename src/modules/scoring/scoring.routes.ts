import { Router } from "express"
import { authenticateScorer } from "../../shared/middleware/authenticate-scorer.js"
import { validate } from "../../shared/middleware/validate.js"
import { matchIdParamsSchema } from "../matches/matches.schema.js"
import { ball, batter, bowler, end, retire, scorecard, start, state, swap, undo } from "./scoring.controller.js"
import {
    chooseBatterSchema,
    chooseBowlerSchema,
    inningsParamsSchema,
    recordBallSchema,
    retireSchema,
    startInningsSchema,
    versionOnlySchema,
} from "./scoring.schema.js"

// Routes mounted at /api/scorer; every one needs the scorer token and an open scoring window
const router = Router()

// GET /api/scorer/scoring: the resume state (match, both innings, the live view of the latest one)
router.get("/scoring", authenticateScorer, state)

// POST /api/scorer/innings/start: opening batters and bowler of the first (or second) innings
router.post("/innings/start", authenticateScorer, validate(startInningsSchema), start)

// POST /api/scorer/innings/:n/deliveries: one ball. The ones below change the same innings the same way.
const innings = Router({ mergeParams: true })
innings.use(authenticateScorer, validate(inningsParamsSchema, "params"))
innings.post("/deliveries", validate(recordBallSchema), ball)
innings.post("/batter", validate(chooseBatterSchema), batter)
innings.post("/bowler", validate(chooseBowlerSchema), bowler)
innings.post("/swap-strike", validate(versionOnlySchema), swap)
innings.post("/retire", validate(retireSchema), retire)
innings.post("/undo", validate(versionOnlySchema), undo)
innings.post("/end", validate(versionOnlySchema), end)
router.use("/innings/:n", innings)

export default router

// Routes mounted at /api/matches (public)
export const scorecardRouter = Router()

// GET /api/matches/:id/scorecard: both innings with every stat, generated from the deliveries
scorecardRouter.get("/:id/scorecard", validate(matchIdParamsSchema, "params"), scorecard)
