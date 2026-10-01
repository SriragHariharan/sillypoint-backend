import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { imageUpload } from "../../shared/middleware/upload.js"
import { validate } from "../../shared/middleware/validate.js"
import { LOGO_FIELD } from "./teams.constants.js"
import { create, details, list, update } from "./teams.controller.js"
import { createTeamSchema, teamIdParamsSchema, updateTeamSchema } from "./teams.schema.js"

const router = Router()

// Every team route needs a logged in user
router.use(authenticate)

// POST /api/teams: reads the optional logo, then checks the form fields
router.post("/", imageUpload(LOGO_FIELD), validate(createTeamSchema), create)

// GET /api/teams: teams managed by the logged in user
router.get("/", list)

// GET /api/teams/:id: one of the user's own teams
router.get("/:id", validate(teamIdParamsSchema, "params"), details)

// PATCH /api/teams/:id: update one of the user's own teams
router.patch("/:id", validate(teamIdParamsSchema, "params"), imageUpload(LOGO_FIELD), validate(updateTeamSchema), update)

export default router
