// Tournament dates are calendar days in this time zone
export const TOURNAMENT_TIMEZONE = "Asia/Kolkata"

export const NAME_MIN_LENGTH = 3
export const NAME_MAX_LENGTH = 80
export const LOCATION_MAX_LENGTH = 120

// The rich text description: at most this many characters of plain text, and this much HTML
export const DESCRIPTION_MAX_TEXT_LENGTH = 500
export const DESCRIPTION_MAX_HTML_LENGTH = 5000

// The only tags the description editor can produce
export const DESCRIPTION_ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li"]

export const LOGO_FIELD = "logo"
export const LOGO_FOLDER = "sillypoint/tournament-logos"

export const LIST_DEFAULT_LIMIT = 12
export const LIST_MAX_LIMIT = 50
export const SEARCH_MAX_LENGTH = 80

export const TOURNAMENT_STATUSES = ["upcoming", "live", "completed", "cancelled"] as const

export const TOURNAMENT_NOT_FOUND = "Tournament not found"
export const NOT_ORGANIZER = "Only the organizer can do this"
export const ALREADY_CANCELLED = "Tournament is already cancelled"
export const ALREADY_COMPLETED = "A completed tournament cannot be cancelled"
export const DESCRIPTION_TOO_LONG = `Description must be at most ${DESCRIPTION_MAX_TEXT_LENGTH} characters`
