// Messages of the scoring module (the cricket rules have their own in engines/scoring/messages.ts)

export const INNINGS_NOT_FOUND = "This innings has not started yet"
export const SCORE_CHANGED = "The score has changed, so the screen was refreshed. Please check it and try again"

export const MATCH_NOT_READY = "Before scoring, the toss must be made, overs per side must be set and both teams need their full playing XI"
export const MATCH_ALREADY_COMPLETED = "This match is already over"
export const MATCH_NOT_FINISHED = "The match result isn't decided yet, so it cannot be concluded"
export const MATCH_CONCLUDED = "This match has been concluded, so it can no longer be changed"
export const FIRST_INNINGS_NOT_OVER = "The first innings is still in progress"
export const BOTH_INNINGS_STARTED = "Both innings have already been started"

export const OPENING_BATTER_NOT_IN_XI = "Opening batters must be from the batting team's playing XI"
export const OPENING_BOWLER_NOT_IN_XI = "The opening bowler must be from the bowling team's playing XI"
export const NEXT_INNINGS_STARTED = "The next innings has already started, so this innings cannot be changed"

export const INNINGS_STARTED = "Innings started"
