import { type NextFunction, type Request, type Response } from "express"
import { ACCESS_TOKEN_EXPIRED, UNAUTHORIZED } from "../constants/jwt.js"
import { failure } from "../http/response.js"
import { isTokenExpired, verifyAccessToken } from "../utils/jwt.js"

// Allows the request only with a valid access token in the Authorization header
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ")

    if (scheme !== "Bearer" || !token) return failure(res, UNAUTHORIZED, 401)

    try {
        const userId = Number(verifyAccessToken(token).sub)
        if (!Number.isInteger(userId)) return failure(res, UNAUTHORIZED, 401)

        res.locals.userId = userId
        next()
    } catch (err) {
        // The frontend calls /refresh when it sees the expired message
        return failure(res, isTokenExpired(err) ? ACCESS_TOKEN_EXPIRED : UNAUTHORIZED, 401)
    }
}

// For public routes that show more to a logged in user: no Authorization header means a guest,
// otherwise the token must be valid (an expired one gets the same 401 so the frontend refreshes and retries)
export const authenticateOptional = (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) return next()
    return authenticate(req, res, next)
}
