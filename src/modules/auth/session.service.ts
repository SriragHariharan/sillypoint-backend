import { createHash, randomUUID } from "node:crypto"
import { db } from "../../db/postgres.js"
import { UnauthorizedError } from "../../shared/http/errors.js"
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt.js"
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_INVALID,
    REFRESH_REUSE_GRACE_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
    SESSION_MAX_AGE_SECONDS,
} from "./auth.constants.js"
import { findUserById, type Tx } from "./auth.repository.js"
import {
    deleteExpiredRefreshTokens,
    findRefreshTokenForUpdate,
    insertRefreshToken,
    revokeFamily,
    revokeRefreshToken,
} from "./session.repository.js"

export type Session = {
    accessToken: string
    expiresIn: number
    refreshToken: string
    refreshExpiresAt: Date
}

// Only the hash of a refresh token is stored, so a database leak does not leak sessions
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

// Create a refresh token in the given session family and save its hash
const createRefreshToken = async (tx: Tx, userId: number, familyId: string, sessionExpiresAt: Date) => {
    const now = Date.now()
    // A rotated token never lives longer than the session itself
    const expiresAt = new Date(Math.min(now + REFRESH_TOKEN_TTL_SECONDS * 1000, sessionExpiresAt.getTime()))
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - now) / 1000))

    const refreshToken = signRefreshToken({ userId, jti: randomUUID(), familyId, ttlSeconds })
    await insertRefreshToken(tx, { userId, familyId, tokenHash: hashToken(refreshToken), expiresAt, sessionExpiresAt })

    return { refreshToken, refreshExpiresAt: expiresAt }
}

// Start a new login session: one access token and one refresh token
export const issueSession = async (userId: number): Promise<Session> => {
    return db.transaction(async (tx) => {
        await deleteExpiredRefreshTokens(tx, userId, new Date())

        const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
        const { refreshToken, refreshExpiresAt } = await createRefreshToken(tx, userId, randomUUID(), sessionExpiresAt)

        return {
            accessToken: signAccessToken(userId, ACCESS_TOKEN_TTL_SECONDS),
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            refreshToken,
            refreshExpiresAt,
        }
    })
}

type RefreshOutcome = { session: Session } | { failed: true }

// Swap a refresh token for a new access + refresh token pair (rotation)
export const refreshSession = async (token: string): Promise<Session> => {
    let claims
    try {
        claims = verifyRefreshToken(token)
    } catch {
        throw new UnauthorizedError(REFRESH_INVALID)
    }

    // Revoking must be saved, so we return the outcome and throw after the transaction commits
    const outcome = await db.transaction(async (tx): Promise<RefreshOutcome> => {
        const row = await findRefreshTokenForUpdate(tx, hashToken(token))
        const now = new Date()

        if (!row || String(row.userId) !== claims.sub || row.familyId !== claims.fam) return { failed: true }

        if (row.revokedAt) {
            // An old token used again after the grace time means it was probably stolen: end the session
            if (now.getTime() - row.revokedAt.getTime() > REFRESH_REUSE_GRACE_SECONDS * 1000) {
                await revokeFamily(tx, row.familyId, now)
            }
            return { failed: true }
        }

        if (row.expiresAt <= now || row.sessionExpiresAt <= now) return { failed: true }

        const user = await findUserById(tx, row.userId)
        if (!user || user.status !== "active") {
            await revokeFamily(tx, row.familyId, now)
            return { failed: true }
        }

        await revokeRefreshToken(tx, row.id, now)
        const { refreshToken, refreshExpiresAt } = await createRefreshToken(tx, row.userId, row.familyId, row.sessionExpiresAt)

        return {
            session: {
                accessToken: signAccessToken(row.userId, ACCESS_TOKEN_TTL_SECONDS),
                expiresIn: ACCESS_TOKEN_TTL_SECONDS,
                refreshToken,
                refreshExpiresAt,
            },
        }
    })

    if ("failed" in outcome) throw new UnauthorizedError(REFRESH_INVALID)
    return outcome.session
}

// End the login session of this refresh token. Never fails, so logout always works.
export const logout = async (token: string | undefined) => {
    if (!token) return

    try {
        verifyRefreshToken(token)
    } catch {
        return
    }

    await db.transaction(async (tx) => {
        const row = await findRefreshTokenForUpdate(tx, hashToken(token))
        if (row) await revokeFamily(tx, row.familyId, new Date())
    })
}
