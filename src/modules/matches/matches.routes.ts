import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { validate } from "../../shared/middleware/validate.js"
import { tournamentIdParamsSchema } from "../tournaments/tournaments.schema.js"
import { create, details, list, reschedule } from "./matches.controller.js"
import { createMatchSchema, matchIdParamsSchema, rescheduleMatchSchema } from "./matches.schema.js"

const router = Router()

// POST /api/tournaments/:id/matches: organizer only
router.post("/:id/matches", authenticate, validate(tournamentIdParamsSchema, "params"), validate(createMatchSchema), create)

// GET /api/tournaments/:id/matches: public list
router.get("/:id/matches", validate(tournamentIdParamsSchema, "params"), list)

// Routes mounted at /api/matches
export const matchRouter = Router()

// GET /api/matches/:id: public details
matchRouter.get("/:id", validate(matchIdParamsSchema, "params"), details)

// PATCH /api/matches/:id/reschedule: organizer only
matchRouter.patch(
    "/:id/reschedule",
    authenticate,
    validate(matchIdParamsSchema, "params"),
    validate(rescheduleMatchSchema),
    reschedule,
)

export default router
