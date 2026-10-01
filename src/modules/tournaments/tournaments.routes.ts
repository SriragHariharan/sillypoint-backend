import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { imageUpload } from "../../shared/middleware/upload.js"
import { validate } from "../../shared/middleware/validate.js"
import { LOGO_FIELD } from "./tournaments.constants.js"
import { addTeams, cancel, create, details, list, listTeams, removeTeam, reschedule } from "./tournaments.controller.js"
import {
    addTeamsSchema,
    createTournamentSchema,
    enrolledTeamParamsSchema,
    listTournamentsQuerySchema,
    rescheduleTournamentSchema,
    tournamentIdParamsSchema,
} from "./tournaments.schema.js"

const router = Router()

// POST /api/tournaments: logged in users only; reads the optional logo, then checks the form fields
router.post("/", authenticate, imageUpload(LOGO_FIELD), validate(createTournamentSchema), create)

// GET /api/tournaments: public list with filters
router.get("/", validate(listTournamentsQuerySchema, "query"), list)

// POST /api/tournaments/:id/cancel: organizer only
router.post("/:id/cancel", authenticate, validate(tournamentIdParamsSchema, "params"), cancel)

// PATCH /api/tournaments/:id/reschedule: organizer only
router.patch("/:id/reschedule", authenticate, validate(tournamentIdParamsSchema, "params"), validate(rescheduleTournamentSchema), reschedule)

// POST /api/tournaments/:id/teams: logged in users add their own teams
router.post("/:id/teams", authenticate, validate(tournamentIdParamsSchema, "params"), validate(addTeamsSchema), addTeams)

// GET /api/tournaments/:id/teams: public list of enrolled teams
router.get("/:id/teams", validate(tournamentIdParamsSchema, "params"), listTeams)

// DELETE /api/tournaments/:id/teams/:teamId: organizer or the user who added the team
router.delete("/:id/teams/:teamId", authenticate, validate(enrolledTeamParamsSchema, "params"), removeTeam)

// GET /api/tournaments/:id: public details
router.get("/:id", validate(tournamentIdParamsSchema, "params"), details)

export default router
