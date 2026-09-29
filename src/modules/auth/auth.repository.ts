import { and, eq } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { otp, otpPurposeEnum, users } from "../../db/schema/index.js"

// Type of a database transaction
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type OtpPurpose = (typeof otpPurposeEnum.enumValues)[number]

// Find a user by mobile number
export const findUserByMobile = async (mobile: string) => {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1)
    return user
}

// Find a user by id
export const findUserById = async (tx: Tx, userId: number) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
    return user
}

// Create a new user
export const insertUser = async (tx: Tx, mobile: string) => {
    const [user] = await tx.insert(users).values({ mobile }).returning()
    return user
}

// Mark a user as verified
export const activateUser = async (tx: Tx, userId: number) => {
    await tx.update(users).set({ status: "active" }).where(eq(users.id, userId))
}

// Get the OTP row and lock it, so parallel requests wait for each other
export const findOtpForUpdate = async (tx: Tx, userId: number, purpose: OtpPurpose) => {
    const [row] = await tx
        .select()
        .from(otp)
        .where(and(eq(otp.userId, userId), eq(otp.purpose, purpose)))
        .limit(1)
        .for("update")
    return row
}

// Save a new hashed OTP
export const insertOtp = async (
    tx: Tx,
    values: { userId: number; otpHash: string; purpose: OtpPurpose; expiresAt: Date },
) => {
    await tx.insert(otp).values(values)
}

// Put a new OTP in an existing row; attempts and resendCount are kept unless a new value is given
export const replaceOtp = async (
    tx: Tx,
    id: number,
    values: { otpHash: string; expiresAt: Date; attempts?: number; resendCount?: number },
) => {
    await tx
        .update(otp)
        .set({ ...values, blockedUntil: null, createdAt: new Date() })
        .where(eq(otp.id, id))
}

// Save a wrong guess (and the block time if the limit is reached)
export const updateOtpFailure = async (tx: Tx, id: number, attempts: number, blockedUntil: Date | null) => {
    await tx.update(otp).set({ attempts, blockedUntil }).where(eq(otp.id, id))
}

// Delete an OTP row (used once it is verified)
export const deleteOtpById = async (tx: Tx, id: number) => {
    await tx.delete(otp).where(eq(otp.id, id))
}

// Find a user by id (outside a transaction)
export const getUserById = async (userId: number) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return user
}
