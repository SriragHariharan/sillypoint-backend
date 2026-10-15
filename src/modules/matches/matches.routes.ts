import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { validate } from "../../shared/middleware/validate.js"
import { tournamentIdParamsSchema } from "../tournaments/tournaments.schema.js"
import { create, list } from "./matches.controller.js"
import { createMatchSchema } from "./matches.schema.js"

const router = Router()

// POST /api/tournaments/:id/matches: organizer only
router.post("/:id/matches", authenticate, validate(tournamentIdParamsSchema, "params"), validate(createMatchSchema), create)

// GET /api/tournaments/:id/matches: public list
router.get("/:id/matches", validate(tournamentIdParamsSchema, "params"), list)

export default router
