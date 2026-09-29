import { type NextFunction, type Request, type Response } from "express"
import { failure } from "../../shared/http/response.js"
import { isTokenExpired, verifyToken } from "../../shared/utils/jwt.js"
import { SET_PIN_EXPIRED, SET_PIN_TOKEN_PURPOSE, SET_PIN_UNAUTHORIZED } from "./auth.constants.js"

// Allows the request only with a valid set-PIN token in the Authorization header
export const requireSetPinToken = (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ")

    if (scheme !== "Bearer" || !token) return failure(res, SET_PIN_UNAUTHORIZED, 401)

    try {
        const claims = verifyToken(token)
        const userId = Number(claims.sub)

        // Other token types (like a future access token) cannot be used here
        if (claims.purpose !== SET_PIN_TOKEN_PURPOSE || !Number.isInteger(userId)) {
            return failure(res, SET_PIN_UNAUTHORIZED, 401)
        }

        res.locals.userId = userId
        next()
    } catch (err) {
        return failure(res, isTokenExpired(err) ? SET_PIN_EXPIRED : SET_PIN_UNAUTHORIZED, 401)
    }
}
