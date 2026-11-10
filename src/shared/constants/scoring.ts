// Ball-by-ball scoring constants shared by the scoring engine, the scoring module and the database schema

export const BALLS_PER_OVER = 6

// Runs that can be counted on one ball (not counting the wide / no-ball penalty run)
export const MAX_RUNS_PER_BALL = 9
// A wide carries its penalty run on top of the runs counted for the ball
export const MAX_WIDES_PER_BALL = MAX_RUNS_PER_BALL + 1
export const FOUR_RUNS = 4
export const SIX_RUNS = 6
// An overthrow that reaches the rope is always worth four
export const OVERTHROW_BOUNDARY_RUNS = FOUR_RUNS

// A bowler may bowl at most ceil(oversPerSide / this) overs
export const BOWLER_QUOTA_DIVIDER = 5

export const EXTRA_TYPES = ["wide", "no_ball", "bye", "leg_bye"] as const
// What the runs scored on a no-ball were: off the bat, byes or leg byes
export const NO_BALL_RUN_KINDS = ["bat", "bye", "leg_bye"] as const

// Ways a batter can be out on a ball
export const BALL_WICKET_TYPES = [
    "bowled",
    "caught",
    "lbw",
    "run_out",
    "stumped",
    "hit_wicket",
    "obstructing_field",
] as const
// Leaving the crease between balls
export const RETIREMENT_TYPES = ["retired_hurt", "retired_out"] as const
export const WICKET_TYPES = [...BALL_WICKET_TYPES, ...RETIREMENT_TYPES] as const
export const WICKET_TYPE_MAX_LENGTH = 20

// Wickets the bowler is credited with
export const BOWLER_WICKET_TYPES = ["bowled", "caught", "lbw", "stumped", "hit_wicket"] as const
// Dismissals that can happen at either end, so the scorer says who is out
export const EITHER_END_WICKET_TYPES = ["run_out", "obstructing_field"] as const
// Dismissals that need the fielder named
export const FIELDER_REQUIRED_WICKET_TYPES = ["caught", "stumped"] as const
// Dismissals where a fielder can be named
export const FIELDER_ALLOWED_WICKET_TYPES = ["caught", "stumped", "run_out"] as const
// Dismissals that allow no runs on the ball
export const NO_RUNS_WICKET_TYPES = ["bowled", "caught", "lbw", "stumped", "hit_wicket"] as const
// What can dismiss a batter on a wide, on a no-ball and on a free hit
export const WIDE_WICKET_TYPES = ["stumped", "run_out", "hit_wicket", "obstructing_field"] as const
export const NO_BALL_WICKET_TYPES = ["run_out", "obstructing_field"] as const

export const DELIVERY_KINDS = ["ball", "retirement"] as const
export const DELIVERY_KIND_MAX_LENGTH = 12

export const INNINGS_STATUSES = ["in_progress", "completed"] as const
export const INNINGS_STATUS_MAX_LENGTH = 12
export const INNINGS_END_REASONS = ["all_out", "overs_complete", "target_reached", "ended_by_scorer"] as const
export const INNINGS_END_REASON_MAX_LENGTH = 20

// Once the first innings has started the toss, the overs and the players are fixed
export const SCORING_STARTED_LOCKED = "Scoring has started, so this can no longer be changed"

export const RESULT_TYPES = ["win", "tie", "no_result"] as const
export const RESULT_TYPE_MAX_LENGTH = 10
export const RESULT_SUMMARY_MAX_LENGTH = 200
