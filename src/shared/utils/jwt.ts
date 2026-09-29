import jwt from "jsonwebtoken"
import { env } from "../config/env.js"
import { ACCESS_TOKEN_AUDIENCE, JWT_ALGORITHM, JWT_ISSUER, REFRESH_TOKEN_AUDIENCE } from "../constants/jwt.js"

export type AccessClaims = { sub: string }
export type RefreshClaims = { sub: string; jti: string; fam: string }

// Create an access token (stateless, short-lived)
export const signAccessToken = (userId: number, ttlSeconds: number) => {
    return jwt.sign({}, env.accessTokenSecret, {
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        subject: String(userId),
        expiresIn: ttlSeconds,
    })
}

// Check an access token and return its claims; throws if it is invalid or expired
export const verifyAccessToken = (token: string): AccessClaims => {
    const payload = jwt.verify(token, env.accessTokenSecret, {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
    })

    if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("Invalid token claims")
    }

    return { sub: payload.sub }
}

// Create a refresh token. jti is unique per token, familyId is shared by one login session.
export const signRefreshToken = (params: { userId: number; jti: string; familyId: string; ttlSeconds: number }) => {
    return jwt.sign({ fam: params.familyId }, env.refreshTokenSecret, {
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
        subject: String(params.userId),
        jwtid: params.jti,
        expiresIn: params.ttlSeconds,
    })
}

// Check a refresh token and return its claims; throws if it is invalid or expired
export const verifyRefreshToken = (token: string): RefreshClaims => {
    const payload = jwt.verify(token, env.refreshTokenSecret, {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
    })

    if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.fam !== "string"
    ) {
        throw new Error("Invalid token claims")
    }

    return { sub: payload.sub, jti: payload.jti, fam: payload.fam }
}

// True if the error means the token has expired
export const isTokenExpired = (err: unknown) => err instanceof jwt.TokenExpiredError
