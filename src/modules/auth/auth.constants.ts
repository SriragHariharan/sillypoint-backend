// OTP is valid for 10 minutes
export const OTP_TTL_MS = 10 * 60 * 1000

// Wrong OTP guesses allowed before the user is blocked
export const OTP_MAX_ATTEMPTS = 5

// How long a user stays blocked after too many wrong guesses (30 minutes)
export const OTP_BLOCK_MS = 30 * 60 * 1000

export const MOBILE_EXISTS = "Mobile already exists"
export const OTP_INVALID = "Invalid or expired OTP"
export const OTP_EXPIRED = "OTP expired, please request a new one"
export const ACCOUNT_BLOCKED = "Account is blocked"

// Resends allowed before the user is blocked
export const OTP_MAX_RESENDS = 5

export const RESEND_INVALID = "Cannot resend OTP"
export const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in"

// PIN must be exactly this many digits
export const PIN_LENGTH = 4

// The token given after OTP verification is valid for 10 minutes
export const SET_PIN_TOKEN_TTL_SECONDS = 10 * 60
export const SET_PIN_TOKEN_PURPOSE = "set_pin"

export const PIN_MISMATCH = "PIN and confirm PIN do not match"
export const SET_PIN_UNAUTHORIZED = "Missing or invalid token"
export const SET_PIN_EXPIRED = "Session expired, please verify your OTP again"
export const SET_PIN_NOT_ALLOWED = "Cannot set PIN"
