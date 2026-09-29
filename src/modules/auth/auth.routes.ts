import { Router } from "express"
import { validate } from "../../shared/middleware/validate.js"
import { requestOtp, resendOtp, verifyOtp } from "./auth.controller.js"
import { requestOtpSchema, resendOtpSchema, verifyOtpSchema } from "./auth.schema.js"

const router = Router()

// POST /api/auth/request-otp: check the body, then send an OTP (signup or login)
router.post("/request-otp", validate(requestOtpSchema), requestOtp)

// POST /api/auth/verify-otp: check the body, then verify the OTP
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp)

// POST /api/auth/resend-otp: check the body, then send a new OTP
router.post("/resend-otp", validate(resendOtpSchema), resendOtp)

export default router
