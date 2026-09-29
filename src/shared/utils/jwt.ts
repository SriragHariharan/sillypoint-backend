import jwt from "jsonwebtoken"

const secret = process.env.JWT_SECRET

if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET environment variable must be set (at least 32 characters)")
}

const ALGORITHM = "HS256"
const ISSUER = "sillypoint"

export type TokenClaims = { sub: string; purpose: string }

// Create a signed token that expires after ttlSeconds
export const signToken = (userId: number, purpose: string, ttlSeconds: number) => {
    return jwt.sign({ purpose }, secret, {
        algorithm: ALGORITHM,
        issuer: ISSUER,
        subject: String(userId),
        expiresIn: ttlSeconds,
    })
}

// Check a token and return its claims; throws if it is invalid or expired
export const verifyToken = (token: string): TokenClaims => {
    const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER })

    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.purpose !== "string") {
        throw new Error("Invalid token claims")
    }

    return { sub: payload.sub, purpose: payload.purpose }
}

// True if the error means the token has expired
export const isTokenExpired = (err: unknown) => err instanceof jwt.TokenExpiredError
