// Match times are entered in the tournament time zone (Asia/Kolkata), which is a fixed +05:30 with no daylight saving
export const MATCH_TIMEZONE_OFFSET = "+05:30"

export const NOTES_MAX_LENGTH = 500

export const MATCH_STAGES = ["group_stage", "eliminator", "qualifier", "quarter_final", "semi_final", "final"] as const
export const STAGE_MAX_LENGTH = 20
export const INVALID_STAGE = "Invalid match stage"

export const MATCH_CREATED = "Match created"
export const MATCH_RESCHEDULED = "Match rescheduled"
export const MATCH_NOT_FOUND = "Match not found"
export const MATCH_ALREADY_STARTED = "A match that has already started cannot be rescheduled"
export const TOURNAMENT_NOT_OPEN_FOR_RESCHEDULE = "Matches of a cancelled or completed tournament cannot be rescheduled"
export const SAME_TEAM = "Pick two different teams"
export const TEAM_NOT_IN_TOURNAMENT = "Both teams must be enrolled in this tournament"
export const TOURNAMENT_NOT_OPEN = "Matches cannot be added to a cancelled or completed tournament"
export const DATE_OUTSIDE_TOURNAMENT = "Match date must be within the tournament dates"
export const MATCH_IN_PAST = "Match time cannot be in the past"

export const SCORER_NAME_MIN_LENGTH = 2
export const SCORER_NAME_MAX_LENGTH = 60
export const SCORER_MOBILE_PATTERN = "^[6-9][0-9]{9}$"
export const SCORER_ADDED = "Scorer added"
export const SCORER_ALREADY_ADDED = "This match already has a scorer"
export const TOURNAMENT_NOT_OPEN_FOR_SCORER = "A scorer cannot be added to a match of a cancelled or completed tournament"

export const SCORER_PIN_LENGTH = 6
// 32 random bytes become 43 base64url characters
export const SCORER_LINK_TOKEN_BYTES = 32
export const SCORER_LINK_TOKEN_MAX_LENGTH = 64
// Wrong mobile/PIN tries in a row before the scorer login of a match is locked
export const SCORER_PIN_MAX_ATTEMPTS = 5
// How long the scorer login stays locked after too many wrong tries (30 minutes)
export const SCORER_LOCK_MS = 30 * 60 * 1000
// Scorer session token lifetime (12 hours)
export const SCORER_TOKEN_TTL_SECONDS = 12 * 60 * 60
export const NO_SCORER = "This match has no scorer"
export const SCORER_INVALID_LOGIN = "Invalid mobile number or PIN"
export const SCORER_LOCKED = "Too many attempts. Try again in"
export const TOURNAMENT_NOT_OPEN_FOR_SCORER_LOGIN = "This tournament is no longer open for scoring"
// The scorer can open the scoring screen this long before the scheduled start (30 minutes)
export const SCORING_OPENS_BEFORE_MS = 30 * 60 * 1000
export const SCORING_NOT_OPEN = "Scoring opens 30 minutes before the match starts"

// What the team that won the toss chose to do
export const TOSS_DECISIONS = ["bat", "bowl"] as const
export const TOSS_DECISION_MAX_LENGTH = 4
export const INVALID_TOSS_DECISION = "Choose batting or bowling"
export const TOSS_TEAM_NOT_IN_MATCH = "The toss winner must be one of the two teams of this match"
export const TOSS_SAVED = "Toss saved"

// Overs each side bats in the match (whole overs), set by the scorer
export const MIN_OVERS_PER_SIDE = 1
export const MAX_OVERS_PER_SIDE = 50
export const INVALID_OVERS = `Overs per side must be a whole number between ${MIN_OVERS_PER_SIDE} and ${MAX_OVERS_PER_SIDE}`
export const OVERS_SAVED = "Overs saved"
