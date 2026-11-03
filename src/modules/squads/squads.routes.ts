import { Router } from "express"
import { authenticateScorer } from "../../shared/middleware/authenticate-scorer.js"
import { validate } from "../../shared/middleware/validate.js"
import { list, save } from "./squads.controller.js"
import { saveSquadsSchema } from "./squads.schema.js"

// Routes mounted at /api/scorer
const router = Router()

// GET /api/scorer/players: scorer token, once scoring has opened
router.get("/players", authenticateScorer, list)

// PUT /api/scorer/players: scorer token, replaces both teams' players (11 + 4 each at most)
router.put("/players", authenticateScorer, validate(saveSquadsSchema), save)

export default router
