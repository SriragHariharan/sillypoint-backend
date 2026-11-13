import { Router } from "express"
import { requireAllowedOrigin } from "../../shared/middleware/allowed-origin.js"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { validate } from "../../shared/middleware/validate.js"
import { demoLogin, logout, me, refresh, requestOtp, resendOtp, verifyOtp } from "./auth.controller.js"
import { demoLoginSchema, requestOtpSchema, resendOtpSchema, verifyOtpSchema } from "./auth.schema.js"

const router = Router()

// POST /api/auth/request-otp: check the body, then send an OTP (signup or login)
router.post("/request-otp", validate(requestOtpSchema), requestOtp)

// POST /api/auth/verify-otp: check the body, then verify the OTP and log the user in
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp)

// POST /api/auth/resend-otp: check the body, then send a new OTP
router.post("/resend-otp", validate(resendOtpSchema), resendOtp)

// POST /api/auth/demo-login: log in to a demo account without an OTP (sets the refresh cookie)
router.post("/demo-login", requireAllowedOrigin, validate(demoLoginSchema), demoLogin)

// POST /api/auth/refresh: uses the refresh cookie, so the request must come from our frontend
router.post("/refresh", requireAllowedOrigin, refresh)

// POST /api/auth/logout: uses the refresh cookie, so the request must come from our frontend
router.post("/logout", requireAllowedOrigin, logout)

// GET /api/auth/me: needs an access token
router.get("/me", authenticate, me)

export default router
