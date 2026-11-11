import { Router } from "express"
import { validate } from "../../shared/middleware/validate.js"
import { tournamentIdParamsSchema } from "../tournaments/tournaments.schema.js"
import { standings } from "./standings.controller.js"

// Routes mounted at /api/tournaments (public)
const router = Router()

// GET /api/tournaments/:id/standings: the points table from the completed league matches
router.get("/:id/standings", validate(tournamentIdParamsSchema, "params"), standings)

export default router
