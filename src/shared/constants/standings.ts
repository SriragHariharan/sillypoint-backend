// Points table: used by the standings engine and the standings module

export const POINTS_FOR_WIN = 2
export const POINTS_FOR_TIE = 1
export const POINTS_FOR_NO_RESULT = 1
export const POINTS_FOR_LOSS = 0

// Matches with these stage labels (or no label) are league matches and count; knockout stages do not
export const LEAGUE_STAGES = ["group_stage"] as const

// Results shown in the form column, latest first
export const FORM_LENGTH = 5
export const NRR_DECIMALS = 3
