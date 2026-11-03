import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { authenticateScorer } from "../../shared/middleware/authenticate-scorer.js"
import { validate } from "../../shared/middleware/validate.js"
import { tournamentIdParamsSchema } from "../tournaments/tournaments.schema.js"
import {
    addScorer,
    create,
    details,
    list,
    reschedule,
    scorerAccess,
    scorerLogin,
    scorerMe,
    scorerToss,
} from "./matches.controller.js"
import {
    addScorerSchema,
    createMatchSchema,
    matchIdParamsSchema,
    rescheduleMatchSchema,
    scorerLoginSchema,
    setTossSchema,
} from "./matches.schema.js"

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

// POST /api/matches/:id/scorer: organizer only, one scorer per match
matchRouter.post("/:id/scorer", authenticate, validate(matchIdParamsSchema, "params"), validate(addScorerSchema), addScorer)

// GET /api/matches/:id/scorer/access: organizer only, the scorer's login link token and PIN
matchRouter.get("/:id/scorer/access", authenticate, validate(matchIdParamsSchema, "params"), scorerAccess)

// Routes mounted at /api/scorer
export const scorerRouter = Router()

// POST /api/scorer/login: public, the scorer proves themselves with the link token, mobile and PIN
scorerRouter.post("/login", validate(scorerLoginSchema), scorerLogin)

// GET /api/scorer/me: scorer token only, the session behind it (also tells when scoring opens)
scorerRouter.get("/me", authenticateScorer, scorerMe)

// PUT /api/scorer/toss: scorer token, once scoring has opened; records or changes the toss
scorerRouter.put("/toss", authenticateScorer, validate(setTossSchema), scorerToss)

export default router
