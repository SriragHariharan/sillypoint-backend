import { randomInt } from "node:crypto"
import argon2 from "argon2"
import { db } from "../../db/postgres.js"
import { BadRequestError, ForbiddenError, TooManyRequestsError } from "../../shared/http/errors.js"
import {
    ACCOUNT_BLOCKED,
    OTP_BLOCK_MS,
    OTP_EXPIRED,
    OTP_INVALID,
    OTP_MAX_ATTEMPTS,
    OTP_MAX_RESENDS,
    OTP_TTL_MS,
    RESEND_INVALID,
    TOO_MANY_ATTEMPTS,
} from "./auth.constants.js"
import { type ResendOtpInput, type VerifyOtpInput } from "./auth.schema.js"
import {
    activateUser,
    deleteOtpById,
    findOtpForUpdate,
    findUserById,
    findUserByMobile,
    insertOtp,
    insertUser,
    type OtpPurpose,
    replaceOtp,
    type Tx,
    updateOtpFailure,
} from "./auth.repository.js"

// Random 4-digit code, like 0042
const generateOtp = () => randomInt(0, 10000).toString().padStart(4, "0")

// True if the database says a new user has a mobile that is already taken
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
    return new TooManyRequestsError(`${TOO_MANY_ATTEMPTS} ${minutes} minutes`)
}

// Send the OTP to the user. TODO: replace with MSG91 SMS delivery.
const sendOtp = (mobile: string, purpose: OtpPurpose, code: string) => {
    console.log(`OTP (${purpose}) for ${mobile}: ${code}`)
}

type OtpRow = NonNullable<Awaited<ReturnType<typeof findOtpForUpdate>>>

// Rules for giving a new OTP to a user who already has an OTP row.
// Returns the block end time if the user is blocked (no OTP is issued), else the resends left.
const reissueOtp = async (tx: Tx, row: OtpRow, otpHash: string, expiresAt: Date) => {
    const now = new Date()

    // Still blocked: no new OTP
    if (row.blockedUntil && row.blockedUntil > now) return { blockedUntil: row.blockedUntil }

    // Block is over: start fresh
    if (row.blockedUntil) {
        await replaceOtp(tx, row.id, { otpHash, expiresAt, attempts: 0, resendCount: 0 })
        return { resendsLeft: OTP_MAX_RESENDS }
    }

    // Resend limit reached: block the user (saved, the caller throws after the transaction)
    if (row.resendCount >= OTP_MAX_RESENDS) {
        const blockedUntil = new Date(Date.now() + OTP_BLOCK_MS)
        await updateOtpFailure(tx, row.id, row.attempts, blockedUntil)
        return { blockedUntil }
    }

    // Resend: new code, keep the wrong-attempt count so the limit cannot be reset
    const resendCount = row.resendCount + 1
    await replaceOtp(tx, row.id, { otpHash, expiresAt, resendCount })
    return { resendsLeft: OTP_MAX_RESENDS - resendCount }
}

// Signup and login are the same step: send an OTP to the mobile.
// A new mobile gets a signup OTP, a verified user gets a login OTP.
export const requestOtp = async (mobile: string, isRetry = false): Promise<{ userId: number; purpose: OtpPurpose }> => {
    const existing = await findUserByMobile(mobile)

    if (existing?.status === "blocked") throw new ForbiddenError(ACCOUNT_BLOCKED)

    const purpose: OtpPurpose = existing?.status === "active" ? "login" : "signup"
    const code = generateOtp()
    // Store only the hash, never the plain OTP
    const otpHash = await argon2.hash(code)

    try {
        // User and OTP are saved together, or not at all
        const result = await db.transaction(async (tx) => {
            const expiresAt = new Date(Date.now() + OTP_TTL_MS)

            // New mobile: create the user and the first OTP
            if (!existing) {
                const created = await insertUser(tx, mobile)
                if (!created) throw new Error("Failed to create user")
                await insertOtp(tx, { userId: created.id, otpHash, purpose, expiresAt })
                sendOtp(mobile, purpose, code)
                return { userId: created.id, blockedUntil: undefined }
            }

            const row = await findOtpForUpdate(tx, existing.id, purpose)

            if (!row) {
                await insertOtp(tx, { userId: existing.id, otpHash, purpose, expiresAt })
                sendOtp(mobile, purpose, code)
                return { userId: existing.id, blockedUntil: undefined }
            }

            // Asking again while an OTP exists counts as a resend
            const { blockedUntil } = await reissueOtp(tx, row, otpHash, expiresAt)
            if (!blockedUntil) sendOtp(mobile, purpose, code)
            return { userId: existing.id, blockedUntil }
        })

        if (result.blockedUntil) throw blockedError(result.blockedUntil)
        return { userId: result.userId, purpose }
    } catch (err) {
        // Two requests for a new mobile at once: the slower one retries as an existing user
        if (!isRetry && isDuplicateUser(err)) return requestOtp(mobile, true)
        throw err
    }
}

// Send a new OTP to a user who asked for one. Returns how many resends are left.
export const resendOtp = async ({ userId, purpose }: ResendOtpInput) => {
    const code = generateOtp()
    const otpHash = await argon2.hash(code)

    const result = await db.transaction(async (tx) => {
        const user = await findUserById(tx, userId)
        if (!user) throw new BadRequestError(RESEND_INVALID)
        if (user.status === "blocked") throw new ForbiddenError(ACCOUNT_BLOCKED)

        // Lock the row so parallel resend taps cannot pass the limit
        const row = await findOtpForUpdate(tx, userId, purpose)
        if (!row) throw new BadRequestError(RESEND_INVALID)

        const expiresAt = new Date(Date.now() + OTP_TTL_MS)
        const outcome = await reissueOtp(tx, row, otpHash, expiresAt)

        // Send last, so a failed send will undo the resend count
        if (!outcome.blockedUntil) sendOtp(user.mobile, purpose, code)
        return outcome
    })

    if (result.blockedUntil) throw blockedError(result.blockedUntil)
    return result.resendsLeft
}

type WrongOtp = { attemptsLeft: number; blockedUntil: Date | null }
type VerifyResult = { wrong: WrongOtp } | { user: { id: number; mobile: string } }

// Check the OTP the user typed. A correct OTP means the user is logged in.
export const verifyOtp = async ({ userId, otp, purpose }: VerifyOtpInput) => {
    // A wrong guess must be saved, so we return it and throw after the transaction commits
    const result = await db.transaction(async (tx): Promise<VerifyResult> => {
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
            return { wrong: { attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts), blockedUntil } }
        }

        const user = await findUserById(tx, userId)
        if (!user) throw new BadRequestError(OTP_INVALID)
        if (user.status === "blocked") throw new ForbiddenError(ACCOUNT_BLOCKED)

        // OTP can be used only once
        await deleteOtpById(tx, row.id)

        // First successful OTP verifies the mobile
        if (purpose === "signup") await activateUser(tx, userId)

        return { user: { id: user.id, mobile: user.mobile } }
    })

    if ("wrong" in result) {
        if (result.wrong.blockedUntil) throw blockedError(result.wrong.blockedUntil)
        throw new BadRequestError(`Invalid OTP. ${result.wrong.attemptsLeft} attempts left`)
    }

    return { user: result.user, isNewUser: purpose === "signup" }
}
