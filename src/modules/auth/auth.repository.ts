import { and, eq } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { otp, otpPurposeEnum, users } from "../../db/schema/index.js"

// Type of a database transaction
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Find a user by mobile number
export const findUserByMobile = async (mobile: string) => {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1)
    return user
}

// Create a new user
export const insertUser = async (tx: Tx, mobile: string) => {
    const [user] = await tx.insert(users).values({ mobile }).returning()
    return user
}

// Remove a user's old OTPs for the given purpose
export const deleteOtpsByUser = async (tx: Tx, userId: number, purpose: (typeof otpPurposeEnum.enumValues)[number]) => {
    await tx.delete(otp).where(and(eq(otp.userId, userId), eq(otp.purpose, purpose)))
}

// Save a new hashed OTP
export const insertOtp = async (
    tx: Tx,
    values: { userId: number; otpHash: string; purpose: (typeof otpPurposeEnum.enumValues)[number]; expiresAt: Date },
) => {
    await tx.insert(otp).values(values)
}
