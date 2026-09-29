import { Router } from "express"
import { validate } from "../../shared/middleware/validate.js"
import { signup, verifyOtp } from "./auth.controller.js"
import { signupSchema, verifyOtpSchema } from "./auth.schema.js"

const router = Router()

// POST /api/auth/signup: check the body using HOF, then run the controller
router.post("/signup", validate(signupSchema), signup)

// POST /api/auth/verify-otp: check the body, then verify the OTP
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp)

export default router
