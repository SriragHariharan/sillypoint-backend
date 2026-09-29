import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { SET_PIN_TOKEN_TTL_SECONDS } from "./auth.constants.js"
import { type ResendOtpInput, type SetPinInput, type SignupInput, type VerifyOtpInput } from "./auth.schema.js"
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
    const setPinToken = await authService.verifyOtp(req.body as VerifyOtpInput)
    // Token is only given after a signup OTP; the frontend sends it back as a Bearer token
    return success(res, {
        message: "OTP verified",
        ...(setPinToken && { setPinToken, expiresIn: SET_PIN_TOKEN_TTL_SECONDS }),
    })
}

// Handles the resend OTP request
export const resendOtp = async (req: Request, res: Response) => {
    const resendsLeft = await authService.resendOtp(req.body as ResendOtpInput)
    return success(res, { message: "OTP resent", resendsLeft })
}

// Handles the set PIN request (user id comes from the token, not the body)
export const setPin = async (req: Request, res: Response) => {
    const { pin } = req.body as SetPinInput
    await authService.setPin(res.locals.userId as number, pin)
    return success(res, { message: "PIN set" })
}
