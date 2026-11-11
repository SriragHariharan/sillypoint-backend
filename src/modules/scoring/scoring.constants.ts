// Messages of the scoring module (the cricket rules have their own in engines/scoring/messages.ts)

export const INNINGS_NOT_FOUND = "This innings has not started yet"
export const SCORE_CHANGED = "The score has changed, so the screen was refreshed. Please check it and try again"

export const MATCH_NOT_READY = "Before scoring, the toss must be made, overs per side must be set and both teams need their full playing XI"
export const MATCH_ALREADY_COMPLETED = "This match is already over"
export const MATCH_OVER = "This match is over, so it can no longer be changed"
export const FIRST_INNINGS_NOT_OVER = "The first innings is still in progress"
export const BOTH_INNINGS_STARTED = "Both innings have already been started"

export const OPENING_BATTER_NOT_IN_XI = "Opening batters must be from the batting team's playing XI"
export const OPENING_BOWLER_NOT_IN_XI = "The opening bowler must be from the bowling team's playing XI"
export const NEXT_INNINGS_STARTED = "The next innings has already started, so this innings cannot be changed"

export const INNINGS_STARTED = "Innings started"

// The public scorecard is cached in memory so many viewers polling one match cost the database one cheap query per TTL
export const SCORECARD_CACHE_TTL_MS = 1000
// A decided match no longer changes, so it is only re-checked now and then
export const SCORECARD_COMPLETED_CACHE_TTL_MS = 30_000
export const SCORECARD_CACHE_MAX_ENTRIES = 500
// Browsers revalidate every poll (cheap 304); a CDN may reuse a live scorecard for 2 seconds and a final one for 5 minutes
export const SCORECARD_CACHE_CONTROL_LIVE = "public, max-age=0, s-maxage=2"
export const SCORECARD_CACHE_CONTROL_COMPLETED = "public, max-age=30, s-maxage=300"
