import { BOWLER_WICKET_TYPES, FOUR_RUNS, SIX_RUNS } from "../../shared/constants/scoring.js"
import { type DeliveryRow, type WicketType } from "./types.js"

type Row = Pick<DeliveryRow, "runsOffBat" | "wides" | "noBalls" | "byes" | "legByes">

// True when `value` is one of the listed strings
export const includes = <T extends string>(list: readonly T[], value: string | null | undefined): value is T =>
    value !== null && value !== undefined && (list as readonly string[]).includes(value)

// Every run the batting team gets from the ball
export const totalRunsOf = (row: Row) => row.runsOffBat + row.wides + row.noBalls + row.byes + row.legByes

// Runs charged to the bowler: byes and leg byes are not
export const bowlerRunsOf = (row: Row) => row.runsOffBat + row.wides + row.noBalls

// A four or a six hit by the batter (a boundary overthrow or boundary byes are not the batter's)
export const batBoundaryOf = (row: Pick<DeliveryRow, "isBoundary" | "overthrowRuns" | "runsOffBat">): "four" | "six" | null => {
    if (!row.isBoundary || row.overthrowRuns !== 0) return null
    if (row.runsOffBat === FOUR_RUNS) return "four"
    if (row.runsOffBat === SIX_RUNS) return "six"
    return null
}

// A wicket that counts against the team (a batter who retires hurt is not out)
export const isTeamWicket = (wicketType: WicketType | null) => wicketType !== null && wicketType !== "retired_hurt"

// A wicket the bowler is credited with
export const isBowlerWicket = (wicketType: WicketType | null) => includes(BOWLER_WICKET_TYPES, wicketType)

// "3.2" for 20 legal balls
export const oversText = (legalBalls: number, ballsPerOver: number) =>
    `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`

export const round = (value: number, digits: number) => {
    const factor = 10 ** digits
    return Math.round(value * factor) / factor
}
