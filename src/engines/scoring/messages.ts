// Messages for the rules the scoring engine enforces (the service turns them into 400 / 409 errors)

export const INNINGS_OVER = "This innings is over"
export const PICK_BATTER_FIRST = "Choose the next batter first"
export const PICK_BOWLER_FIRST = "Choose the next bowler first"
export const NOTHING_TO_PICK = "There is nobody to choose right now"
export const NO_EMPTY_BATTER_PLACE = "Both batters are already at the crease"

export const INVALID_RUNS = "Those runs are not possible for one ball"
export const BYE_RUNS_REQUIRED = "Enter how many byes or leg byes were run"
export const OVERTHROW_TOO_BIG = "The overthrow runs cannot be more than the runs on the ball"
export const OVERTHROW_BOUNDARY_RUNS_INVALID = "An overthrow that reaches the boundary is worth 4 runs"
export const BOUNDARY_RUNS_INVALID = "A boundary is worth 4 or 6 runs"

export const WICKET_NOT_POSSIBLE_ON_FREE_HIT = "On a free hit the batter can only be run out or obstruct the field"
export const WICKET_NOT_POSSIBLE_ON_WIDE = "On a wide the batter can only be stumped, run out, hit wicket or obstruct the field"
export const WICKET_NOT_POSSIBLE_ON_NO_BALL = "On a no ball the batter can only be run out or obstruct the field"
export const NO_RUNS_ON_THIS_WICKET = "No runs can be scored on this kind of dismissal"
export const DISMISSED_REQUIRED = "Choose which batter is out"
export const DISMISSED_NOT_AT_CREASE = "That batter is not at the crease"
export const DISMISSED_MUST_BE_STRIKER = "Only the batter on strike can be out this way"
export const FIELDER_REQUIRED = "Choose the fielder"
export const FIELDER_NOT_IN_FIELDING_SIDE = "The fielder must be a player of the bowling team"

export const PLAYER_NOT_AVAILABLE = "That player cannot come in to bat"
export const BOWLER_NOT_AVAILABLE = "That player cannot bowl this over"
export const BOWLER_CHANGE_TOO_LATE = "The bowler can only be changed before the first ball of the over"
export const BOWLER_BOWLED_LAST_OVER = "bowled the last over"
export const BOWLER_QUOTA_REACHED = "bowled the maximum overs"

export const RETIRE_NOT_AT_CREASE = "Only a batter at the crease can retire"
export const RETIRE_WITH_PICK_PENDING = "Choose the next batter or bowler before retiring a batter"
export const SWAP_NEEDS_TWO_BATTERS = "Both batters must be at the crease to swap them"
export const NOTHING_TO_UNDO = "There is nothing to undo"
