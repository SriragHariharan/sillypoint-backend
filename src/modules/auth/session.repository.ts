import { and, eq, isNull, lt } from "drizzle-orm"
import { refreshTokens } from "../../db/schema/index.js"
import { type Tx } from "./auth.repository.js"

// Save a new refresh token (only its hash)
export const insertRefreshToken = async (
    tx: Tx,
    values: {
        userId: number
        familyId: string
        tokenHash: string
        expiresAt: Date
        sessionExpiresAt: Date
    },
) => {
    await tx.insert(refreshTokens).values(values)
}

// Find a refresh token by its hash and lock the row, so parallel refresh calls wait for each other
export const findRefreshTokenForUpdate = async (tx: Tx, tokenHash: string) => {
    const [row] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1).for("update")
    return row
}

// Mark one refresh token as used
export const revokeRefreshToken = async (tx: Tx, id: number, at: Date) => {
    await tx.update(refreshTokens).set({ revokedAt: at }).where(eq(refreshTokens.id, id))
}

// End a whole login session: every token in the family stops working
export const revokeFamily = async (tx: Tx, familyId: string, at: Date) => {
    await tx
        .update(refreshTokens)
        .set({ revokedAt: at })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
}

// Clean up old tokens of a user
export const deleteExpiredRefreshTokens = async (tx: Tx, userId: number, now: Date) => {
    await tx.delete(refreshTokens).where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, now)))
}
