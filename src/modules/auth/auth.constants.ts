// OTP is valid for 10 minutes
export const OTP_TTL_MS = 10 * 60 * 1000

// Wrong OTP guesses allowed before the user is blocked
export const OTP_MAX_ATTEMPTS = 5

// How long a user stays blocked after too many wrong guesses (30 minutes)
export const OTP_BLOCK_MS = 30 * 60 * 1000

// Resends allowed before the user is blocked
export const OTP_MAX_RESENDS = 5

export const OTP_INVALID = "Invalid or expired OTP"
export const OTP_EXPIRED = "OTP expired, please request a new one"
export const ACCOUNT_BLOCKED = "Account is blocked"
export const RESEND_INVALID = "Cannot resend OTP"
export const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in"
