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

// Access token: short-lived, kept in memory by the frontend (15 minutes)
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

// Refresh token: replaced on every use (7 days)
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

// A login session ends after this time even if the refresh token keeps being used (30 days)
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

// A refresh token used again this soon after its rotation is a double request, not a theft
export const REFRESH_REUSE_GRACE_SECONDS = 10

export const REFRESH_COOKIE_NAME = "refresh_token"
export const REFRESH_COOKIE_PATH = "/api/auth"

export const REFRESH_INVALID = "Invalid or expired session"
