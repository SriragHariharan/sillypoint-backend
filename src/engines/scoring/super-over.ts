import { MAX_INNINGS, REGULAR_INNINGS, SUPER_OVER_OVERS, SUPER_OVER_WICKETS } from "../../shared/constants/scoring.js"
import { batBoundaryOf } from "./delivery-math.js"
import { TIED_AFTER_SUPER_OVER, WON_ON_BOUNDARY_COUNT, WON_SUPER_OVER } from "./messages.js"
import { type MatchResult, type Side } from "./result.js"
import { type DeliveryRow, type InningsEndReason, type MatchRules } from "./types.js"

// Innings 3 and 4 are the Super Over played after a tie
export const isSuperOverInnings = (inningsNumber: number) =>
    inningsNumber > REGULAR_INNINGS && inningsNumber <= MAX_INNINGS

// One over a side, and the second wicket ends the innings (all out comes at playersPerSide - 1 wickets)
export const superOverRules = (): MatchRules => ({
    oversPerSide: SUPER_OVER_OVERS,
    playersPerSide: SUPER_OVER_WICKETS + 1,
})

// A tie after the regular innings goes to a Super Over, unless the scorer ended the innings (the match was called off)
export const goesToSuperOver = (result: MatchResult, endReason: InningsEndReason | null) =>
    result.resultType === "tie" && endReason !== "ended_by_scorer"

// Fours and sixes hit by each batting team, from the deliveries of the whole match
export const countBoundaries = (rows: readonly (Pick<DeliveryRow, "isBoundary" | "overthrowRuns" | "runsOffBat"> & { battingTeamId: number })[]) => {
    const counts = new Map<number, number>()
    for (const row of rows) {
        if (batBoundaryOf(row) !== null) counts.set(row.battingTeamId, (counts.get(row.battingTeamId) ?? 0) + 1)
    }
    return counts
}

// Who won the Super Over. Level scores again are settled by the boundaries of the whole match (Super Over
// included); if those are level too the match is a tie.
export const computeSuperOverResult = (input: {
    first: Side
    second: Side
    boundaries: ReadonlyMap<number, number>
}): MatchResult => {
    const { first, second, boundaries } = input

    if (first.runs !== second.runs) {
        const winner = second.runs > first.runs ? second : first
        return {
            resultType: "win",
            winnerTeamId: winner.teamId,
            summary: `${winner.name} ${WON_SUPER_OVER}`,
            decidedBy: "super_over",
        }
    }

    const firstCount = boundaries.get(first.teamId) ?? 0
    const secondCount = boundaries.get(second.teamId) ?? 0
    if (firstCount === secondCount) {
        return { resultType: "tie", winnerTeamId: null, summary: TIED_AFTER_SUPER_OVER, decidedBy: null }
    }

    const [winner, winnerCount, loserCount] =
        firstCount > secondCount ? [first, firstCount, secondCount] : [second, secondCount, firstCount]
    return {
        resultType: "win",
        winnerTeamId: winner.teamId,
        summary: `${winner.name} ${WON_ON_BOUNDARY_COUNT} (${winnerCount} v ${loserCount})`,
        decidedBy: "boundary_count",
    }
}
