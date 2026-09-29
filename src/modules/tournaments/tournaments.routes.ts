import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { imageUpload } from "../../shared/middleware/upload.js"
import { validate } from "../../shared/middleware/validate.js"
import { LOGO_FIELD } from "./tournaments.constants.js"
import { cancel, create, details, list } from "./tournaments.controller.js"
import { createTournamentSchema, listTournamentsQuerySchema, tournamentIdParamsSchema } from "./tournaments.schema.js"

const router = Router()

// POST /api/tournaments: logged in users only; reads the optional logo, then checks the form fields
router.post("/", authenticate, imageUpload(LOGO_FIELD), validate(createTournamentSchema), create)

// GET /api/tournaments: public list with filters
router.get("/", validate(listTournamentsQuerySchema, "query"), list)

// POST /api/tournaments/:id/cancel: organizer only
router.post("/:id/cancel", authenticate, validate(tournamentIdParamsSchema, "params"), cancel)

// GET /api/tournaments/:id: public details
router.get("/:id", validate(tournamentIdParamsSchema, "params"), details)

export default router
