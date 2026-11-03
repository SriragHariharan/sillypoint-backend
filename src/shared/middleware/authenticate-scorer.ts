import { type NextFunction, type Request, type Response } from "express"
import { ACCESS_TOKEN_EXPIRED, UNAUTHORIZED } from "../constants/jwt.js"
import { failure } from "../http/response.js"
import { isTokenExpired, verifyScorerToken } from "../utils/jwt.js"

// Allows the request only with a valid scorer token in the Authorization header; sets res.locals.matchId
export const authenticateScorer = (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ")

    if (scheme !== "Bearer" || !token) return failure(res, UNAUTHORIZED, 401)

    try {
        const matchId = Number(verifyScorerToken(token).sub)
        if (!Number.isInteger(matchId)) return failure(res, UNAUTHORIZED, 401)

        res.locals.matchId = matchId
        next()
    } catch (err) {
        return failure(res, isTokenExpired(err) ? ACCESS_TOKEN_EXPIRED : UNAUTHORIZED, 401)
    }
}
