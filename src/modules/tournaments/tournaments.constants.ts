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

export const MAX_TEAMS_PER_REQUEST = 50
export const TEAMS_ADDED = "Teams added"
export const TEAM_REMOVED = "Team removed"
export const TOURNAMENT_NOT_OPEN = "Teams cannot be added to a cancelled or completed tournament"
export const TEAM_ALREADY_ENROLLED = "One or more teams are already added to this tournament"
export const TEAM_NOT_ENROLLED = "Team is not in this tournament"
export const NOT_ALLOWED_TO_REMOVE_TEAM = "Only the organizer or the user who added the team can remove it"
export const ORGANIZER_CANNOT_ADD_TEAMS = "Organizers cannot add teams to their own tournament"
export const CANCELLED_CANNOT_RESCHEDULE = "A cancelled tournament cannot be rescheduled"
export const COMPLETED_CANNOT_RESCHEDULE = "A completed tournament cannot be rescheduled"
export const TOURNAMENT_RESCHEDULED = "Tournament rescheduled"

// Registration fee and prize money are whole rupees
export const MAX_AMOUNT = 10_000_000
export const PRIZE_MONEY_UPDATED = "Prize money updated"
export const NOT_OPEN_FOR_UPDATE = "A cancelled or completed tournament cannot be edited"
