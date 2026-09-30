import { eq } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { users } from "../../db/schema/index.js"

// Type of a database transaction
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Get the user's status and current photo, and lock the row so two changes cannot mix
export const findUserForUpdate = async (tx: Tx, userId: number) => {
    const [row] = await tx
        .select({ status: users.status, avatarPublicId: users.avatarPublicId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for("update")
    return row
}

// Save (or clear) the profile photo
export const setAvatar = async (
    tx: Tx,
    userId: number,
    values: { avatarUrl: string | null; avatarPublicId: string | null },
) => {
    await tx.update(users).set(values).where(eq(users.id, userId))
}
