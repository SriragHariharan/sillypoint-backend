import { Router } from "express"
import { validate } from "../../shared/middleware/validate.js"
import { resendOtp, setPin, signup, verifyOtp } from "./auth.controller.js"
import { requireSetPinToken } from "./auth.middleware.js"
import { resendOtpSchema, setPinSchema, signupSchema, verifyOtpSchema } from "./auth.schema.js"

const router = Router()

// POST /api/auth/signup: check the body using HOF, then run the controller
router.post("/signup", validate(signupSchema), signup)

// POST /api/auth/verify-otp: check the body, then verify the OTP
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp)

// POST /api/auth/resend-otp: check the body, then send a new OTP
router.post("/resend-otp", validate(resendOtpSchema), resendOtp)

// POST /api/auth/set-pin: needs the token from verify-otp, then checks the body
router.post("/set-pin", requireSetPinToken, validate(setPinSchema), setPin)

export default router
