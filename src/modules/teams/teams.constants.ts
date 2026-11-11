export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 60
export const MANAGER_NAME_MAX_LENGTH = 60

// Indian mobile number: 10 digits starting with 6-9
export const MOBILE_REGEX = /^[6-9]\d{9}$/

export const LOGO_FIELD = "logo"
export const LOGO_FOLDER = "sillypoint/team-logos"

export const TEAM_NOT_FOUND = "Team not found"
export const NOTHING_TO_UPDATE = "Provide at least one field to update"

// A team's match history: the state of a match, worked out from the match and its tournament.
// "played" is live or completed (scoring has started), the history list without the upcoming matches.
export const TEAM_MATCH_STATUSES = ["upcoming", "live", "completed", "played"] as const
export const TEAM_MATCHES_DEFAULT_LIMIT = 10
export const TEAM_MATCHES_MAX_LIMIT = 50
