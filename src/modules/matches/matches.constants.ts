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
