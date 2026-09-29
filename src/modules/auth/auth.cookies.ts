import { type Response } from "express"
import { env } from "../../shared/config/env.js"
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "./auth.constants.js"

// JavaScript cannot read this cookie; it is only sent to the auth endpoints of the same site
const cookieOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
} as const

// Put the refresh token in an HttpOnly cookie
export const setRefreshCookie = (res: Response, token: string, expires: Date) => {
    res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions, expires })
}

// Remove the refresh cookie from the browser
export const clearRefreshCookie = (res: Response) => {
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions)
}
