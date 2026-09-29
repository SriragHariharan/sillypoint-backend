import { type NextFunction, type Request, type Response } from "express"
import { env } from "../config/env.js"
import { ORIGIN_NOT_ALLOWED } from "../constants/http.js"
import { failure } from "../http/response.js"

// Blocks cookie-based requests that come from another website (extra CSRF protection).
// Browsers always send Origin on POST, so a missing Origin is a non-browser client.
export const requireAllowedOrigin = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    if (origin && origin !== env.clientOrigin) return failure(res, ORIGIN_NOT_ALLOWED, 403)

    next()
}
