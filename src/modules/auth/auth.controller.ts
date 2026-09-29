import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { REFRESH_COOKIE_NAME } from "./auth.constants.js"
import { clearRefreshCookie, setRefreshCookie } from "./auth.cookies.js"
import { type RequestOtpInput, type ResendOtpInput, type VerifyOtpInput } from "./auth.schema.js"
import * as authService from "./auth.service.js"
import * as sessionService from "./session.service.js"

// Send the tokens: refresh token in the HttpOnly cookie, access token in the body
const sendSession = (res: Response, session: sessionService.Session, body: object) => {
    setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt)
    // Responses with tokens must never be cached
    res.setHeader("Cache-Control", "no-store")
    return success(res, { ...body, accessToken: session.accessToken, expiresIn: session.expiresIn })
}

// Handles the request OTP step (signup and login look the same to the frontend)
export const requestOtp = async (req: Request, res: Response) => {
    // Body is already checked by the validate middleware
    const { mobile } = req.body as RequestOtpInput
    const { userId, purpose } = await authService.requestOtp(mobile)
    // Never send the OTP back in the response
    return success(res, { message: "OTP sent", userId, purpose }, 201)
}

// Handles the OTP verification request: a correct OTP logs the user in
export const verifyOtp = async (req: Request, res: Response) => {
    const { user, isNewUser, session } = await authService.verifyOtp(req.body as VerifyOtpInput)
    return sendSession(res, session, { message: "OTP verified", user, isNewUser })
}

// Handles the resend OTP request
export const resendOtp = async (req: Request, res: Response) => {
    const resendsLeft = await authService.resendOtp(req.body as ResendOtpInput)
    return success(res, { message: "OTP resent", resendsLeft })
}

// Read the refresh token from the cookie
const readRefreshCookie = (req: Request): string | undefined => {
    const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME]
    return typeof token === "string" ? token : undefined
}

// Swap the refresh cookie for a new access token and a new refresh cookie
export const refresh = async (req: Request, res: Response) => {
    try {
        const session = await sessionService.refreshSession(readRefreshCookie(req) ?? "")
        return sendSession(res, session, { message: "Token refreshed" })
    } catch (err) {
        // A bad session must not keep sending its cookie
        clearRefreshCookie(res)
        throw err
    }
}

// End the login session
export const logout = async (req: Request, res: Response) => {
    await sessionService.logout(readRefreshCookie(req))
    clearRefreshCookie(res)
    return success(res, { message: "Logged out" })
}

// Return the logged in user
export const me = async (_req: Request, res: Response) => {
    const user = await authService.getMe(res.locals.userId as number)
    return success(res, { user })
}
