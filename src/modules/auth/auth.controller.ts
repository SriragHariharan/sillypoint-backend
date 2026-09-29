import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type RequestOtpInput, type ResendOtpInput, type VerifyOtpInput } from "./auth.schema.js"
import * as authService from "./auth.service.js"

// Handles the request OTP step (signup and login look the same to the frontend)
export const requestOtp = async (req: Request, res: Response) => {
    // Body is already checked by the validate middleware
    const { mobile } = req.body as RequestOtpInput
    const { userId, purpose } = await authService.requestOtp(mobile)
    // Never send the OTP back in the response
    return success(res, { message: "OTP sent", userId, purpose }, 201)
}

// Handles the OTP verification request: a correct OTP means the user is logged in
export const verifyOtp = async (req: Request, res: Response) => {
    const { user, isNewUser } = await authService.verifyOtp(req.body as VerifyOtpInput)
    return success(res, { message: "OTP verified", user, isNewUser })
}

// Handles the resend OTP request
export const resendOtp = async (req: Request, res: Response) => {
    const resendsLeft = await authService.resendOtp(req.body as ResendOtpInput)
    return success(res, { message: "OTP resent", resendsLeft })
}
