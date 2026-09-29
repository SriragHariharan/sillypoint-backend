import { randomInt } from "node:crypto"
import argon2 from "argon2"
import { db } from "../../db/postgres.js"
import { BadRequestError, ConflictError, ForbiddenError, TooManyRequestsError } from "../../shared/http/errors.js"
import {
    ACCOUNT_BLOCKED,
    MOBILE_EXISTS,
    OTP_BLOCK_MS,
    OTP_EXPIRED,
    OTP_INVALID,
    OTP_MAX_ATTEMPTS,
    OTP_TTL_MS,
} from "./auth.constants.js"
import { type VerifyOtpInput } from "./auth.schema.js"
import {
    activateUser,
    deleteOtpById,
    findOtpForUpdate,
    findUserById,
    findUserByMobile,
    insertOtp,
    insertUser,
    replaceOtp,
    updateOtpFailure,
} from "./auth.repository.js"

// Random 4-digit code, like 0042
const generateOtp = () => randomInt(0, 10000).toString().padStart(4, "0")

// True if the database says the new user's mobile is already taken
const isDuplicateUser = (err: unknown) => {
    const cause = err instanceof Error ? (err.cause ?? err) : err
    return (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === "23505" &&
        "table_name" in cause &&
        cause.table_name === "users"
    )
}

// Error for a user who is still blocked
const blockedError = (until: Date) => {
    const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000))
    return new TooManyRequestsError(`Too many wrong attempts. Try again in ${minutes} minutes`)
}

// Signup step 1: create the user and send an OTP. Returns the user id.
export const signup = async (mobile: string) => {
    const existing = await findUserByMobile(mobile)

    // Only unverified (inactive) users may retry signup; everyone else already has an account.
    if (existing && existing.status !== "inactive") {
        throw new ConflictError(MOBILE_EXISTS)
    }

    const code = generateOtp()
    // Store only the hash, never the plain OTP
    const otpHash = await argon2.hash(code)

    let userId: number

    try {
        // User and OTP are saved together, or not at all
        userId = await db.transaction(async (tx) => {
            const expiresAt = new Date(Date.now() + OTP_TTL_MS)

            // New mobile: create the user and the first OTP
            if (!existing) {
                const created = await insertUser(tx, mobile)
                if (!created) throw new Error("Failed to create user")
                await insertOtp(tx, { userId: created.id, otpHash, purpose: "signup", expiresAt })
                return created.id
            }

            const row = await findOtpForUpdate(tx, existing.id, "signup")

            if (!row) {
                await insertOtp(tx, { userId: existing.id, otpHash, purpose: "signup", expiresAt })
            } else if (row.blockedUntil && row.blockedUntil > new Date()) {
                // Still blocked: no new OTP
                throw blockedError(row.blockedUntil)
            } else if (row.blockedUntil) {
                // Block is over: start fresh
                await replaceOtp(tx, row.id, { otpHash, expiresAt, attempts: 0 })
            } else {
                // Resend: new code, but keep the wrong-attempt count so the limit cannot be reset
                await replaceOtp(tx, row.id, { otpHash, expiresAt })
            }

            return existing.id
        })
    } catch (err) {
        if (isDuplicateUser(err)) throw new ConflictError(MOBILE_EXISTS)
        throw err
    }

    // TODO: replace with MSG91 SMS delivery.
    console.log(`Signup OTP for ${mobile}: ${code}`)

    return userId
}

type WrongOtp = { attemptsLeft: number; blockedUntil: Date | null }

// Signup step 2: check the OTP the user typed
export const verifyOtp = async ({ userId, otp, purpose }: VerifyOtpInput) => {
    // A wrong guess must be saved, so we return it and throw after the transaction commits
    const wrong = await db.transaction(async (tx): Promise<WrongOtp | null> => {
        const row = await findOtpForUpdate(tx, userId, purpose)

        // Same message for no user and no OTP, so ids cannot be probed
        if (!row) throw new BadRequestError(OTP_INVALID)

        const now = new Date()

        if (row.blockedUntil) {
            if (row.blockedUntil > now) throw blockedError(row.blockedUntil)
            // Old block, the user must ask for a new OTP
            throw new BadRequestError(OTP_EXPIRED)
        }

        // Expired OTPs do not use up an attempt
        if (row.expiresAt < now) throw new BadRequestError(OTP_EXPIRED)

        const correct = await argon2.verify(row.otpHash, otp)

        if (!correct) {
            const attempts = row.attempts + 1
            const blockedUntil = attempts >= OTP_MAX_ATTEMPTS ? new Date(Date.now() + OTP_BLOCK_MS) : null
            await updateOtpFailure(tx, row.id, attempts, blockedUntil)
            return { attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts), blockedUntil }
        }

        const user = await findUserById(tx, userId)
        if (!user) throw new BadRequestError(OTP_INVALID)
        if (user.status === "blocked") throw new ForbiddenError(ACCOUNT_BLOCKED)

        // OTP can be used only once
        await deleteOtpById(tx, row.id)

        if (purpose === "signup") await activateUser(tx, userId)

        return null
    })

    if (wrong?.blockedUntil) throw blockedError(wrong.blockedUntil)
    if (wrong) throw new BadRequestError(`Invalid OTP. ${wrong.attemptsLeft} attempts left`)
}
