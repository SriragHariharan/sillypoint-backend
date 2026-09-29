import { Router } from "express"
import { validate } from "../../shared/middleware/validate.js"
import { signup } from "./auth.controller.js"
import { signupSchema } from "./auth.schema.js"

const router = Router()

// POST /api/auth/signup: check the body using HOF, then run the controller
router.post("/signup", validate(signupSchema), signup)

export default router
