import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type SignupInput, type VerifyOtpInput } from "./auth.schema.js"
import * as authService from "./auth.service.js"

// Handles the signup request
export const signup = async (req: Request, res: Response) => {
    // Body is already checked by the validate middleware
    const { mobile } = req.body as SignupInput
    const userId = await authService.signup(mobile)
    // Never send the OTP back in the response
    return success(res, { message: "OTP sent", userId }, 201)
}

// Handles the OTP verification request
export const verifyOtp = async (req: Request, res: Response) => {
    await authService.verifyOtp(req.body as VerifyOtpInput)
    return success(res, { message: "OTP verified" })
}
