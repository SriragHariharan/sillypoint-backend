import { randomInt } from "node:crypto"
import argon2 from "argon2"
import { db } from "../../db/postgres.js"
import { ConflictError } from "../../shared/http/errors.js"
import { MOBILE_EXISTS, OTP_TTL_MS } from "./auth.constants.js"
import { deleteOtpsByUser, findUserByMobile, insertOtp, insertUser } from "./auth.repository.js"

// Random 4-digit code, like 0042
const generateOtp = () => randomInt(0, 10000).toString().padStart(4, "0")

// True if the database says the mobile is already taken
const isUniqueViolation = (err: unknown) => {
    const cause = err instanceof Error ? (err.cause ?? err) : err
    return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505"
}

// Signup step 1: create the user and send an OTP
export const signup = async (mobile: string) => {
    const existing = await findUserByMobile(mobile)

    // Only unverified (inactive) users may retry signup; everyone else already has an account.
    if (existing && existing.status !== "inactive") {
        throw new ConflictError(MOBILE_EXISTS)
    }

    const code = generateOtp()
    // Store only the hash, never the plain OTP
    const otpHash = await argon2.hash(code)

    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    try {
        // User and OTP are saved together, or not at all
        await db.transaction(async (tx) => {
            let userId = existing?.id

            // New mobile: create the user. Retry: clear the old OTP.
            if (userId === undefined) {
                const created = await insertUser(tx, mobile)
                if (!created) throw new Error("Failed to create user")
                userId = created.id
            } else {
                await deleteOtpsByUser(tx, userId, "signup")
            }

            await insertOtp(tx, { userId, otpHash, purpose: "signup", expiresAt })
        })
    } catch (err) {
        if (isUniqueViolation(err)) throw new ConflictError(MOBILE_EXISTS)
        throw err
    }

    // TODO: replace with MSG91 SMS delivery.
    console.log(`Signup OTP for ${mobile}: ${code}`)
}
