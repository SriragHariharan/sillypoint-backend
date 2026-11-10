import { BALLS_PER_OVER, BOWLER_QUOTA_DIVIDER } from "../../shared/constants/scoring.js"
import { isTeamWicket } from "./delivery-math.js"
import { BOWLER_BOWLED_LAST_OVER, BOWLER_QUOTA_REACHED } from "./messages.js"
import {
    type DeliveryRow,
    type InningsEndReason,
    type InningsSnapshot,
    type MatchRules,
    type PlayerInfo,
} from "./types.js"

// The over the next ball belongs to (0-based). After the 6th legal ball it is already the next over.
export const currentOverOf = (legalBalls: number) => Math.floor(legalBalls / BALLS_PER_OVER)

// Why the innings is over, if it is: the chase is won, the side is all out or the overs are used up
export const endReasonOf = (
    snapshot: Pick<InningsSnapshot, "runs" | "wickets" | "legalBalls" | "target">,
    rules: MatchRules,
): InningsEndReason | null => {
    if (snapshot.target !== null && snapshot.runs >= snapshot.target) return "target_reached"
    if (snapshot.wickets >= rules.playersPerSide - 1) return "all_out"
    if (snapshot.legalBalls >= rules.oversPerSide * BALLS_PER_OVER) return "overs_complete"
    return null
}

// A free hit follows a no-ball, even into the next over (a batter retiring in between does not cancel it)
export const isFreeHitNext = (rows: readonly DeliveryRow[]) => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index]
        if (row && row.kind === "ball") return row.noBalls > 0
    }
    return false
}

// How many balls (legal or not) were bowled in an over
export const ballsBowledInOver = (rows: readonly DeliveryRow[], overNumber: number) =>
    rows.filter((row) => row.kind === "ball" && row.overNumber === overNumber).length

export type BatterStatus = "out" | "retired_out" | "retired_hurt"

// Batters who are no longer (or not for now) available: out, retired out, or retired hurt (who may come back).
// A retired-hurt batter who is seen at the crease again is available again.
export const batterStatuses = (rows: readonly DeliveryRow[]) => {
    const statuses = new Map<number, BatterStatus>()

    for (const row of rows) {
        for (const id of [row.strikerId, row.nonStrikerId]) {
            if (statuses.get(id) === "retired_hurt") statuses.delete(id)
        }

        if (row.dismissedPlayerId === null || row.wicketType === null) continue
        if (row.wicketType === "retired_hurt") statuses.set(row.dismissedPlayerId, "retired_hurt")
        else if (row.wicketType === "retired_out") statuses.set(row.dismissedPlayerId, "retired_out")
        else if (isTeamWicket(row.wicketType)) statuses.set(row.dismissedPlayerId, "out")
    }

    return statuses
}

export type BatterOption = PlayerInfo & { retiredHurt: boolean }

// Who can come in to bat: the playing XI who are not at the crease, not out and not retired out
export const batterOptions = (
    rows: readonly DeliveryRow[],
    battingPlayers: readonly PlayerInfo[],
    snapshot: Pick<InningsSnapshot, "strikerId" | "nonStrikerId">,
): BatterOption[] => {
    const statuses = batterStatuses(rows)
    return battingPlayers
        .filter((player) => player.id !== snapshot.strikerId && player.id !== snapshot.nonStrikerId)
        .filter((player) => {
            const status = statuses.get(player.id)
            return status !== "out" && status !== "retired_out"
        })
        .map((player) => ({ ...player, retiredHurt: statuses.get(player.id) === "retired_hurt" }))
}

// The most overs one bowler may bowl (4 in a 20-over match)
export const bowlerQuota = (oversPerSide: number) => Math.ceil(oversPerSide / BOWLER_QUOTA_DIVIDER)

// Overs a bowler has bowled so far (an over counts once he has bowled a ball of it)
export const oversBowledBy = (rows: readonly DeliveryRow[], bowlerId: number, exceptOver?: number) => {
    const overs = new Set<number>()
    for (const row of rows) {
        if (row.kind === "ball" && row.bowlerId === bowlerId && row.overNumber !== exceptOver) overs.add(row.overNumber)
    }
    return overs.size
}

export type BowlerOption = PlayerInfo & { overs: number; disabledReason: string | null }

// Who can bowl the over that is about to start. The bowler of the previous over cannot bowl again and nobody can
// go past the quota; if that would leave nobody, the previous bowler is allowed so the innings can finish.
export const bowlerOptions = (
    rows: readonly DeliveryRow[],
    bowlingPlayers: readonly PlayerInfo[],
    legalBalls: number,
    rules: MatchRules,
): BowlerOption[] => {
    const over = currentOverOf(legalBalls)
    const quota = bowlerQuota(rules.oversPerSide)

    const lastOverRow = [...rows].reverse().find((row) => row.kind === "ball" && row.overNumber === over - 1)
    const lastBowlerId = lastOverRow?.bowlerId ?? null

    const options = bowlingPlayers.map((player) => {
        const overs = oversBowledBy(rows, player.id, over)
        const disabledReason =
            overs >= quota ? BOWLER_QUOTA_REACHED : player.id === lastBowlerId ? BOWLER_BOWLED_LAST_OVER : null
        return { ...player, overs, disabledReason }
    })

    const nobodyLeft = options.every((option) => option.disabledReason !== null)
    if (!nobodyLeft) return options

    // Only the consecutive-over rule may be relaxed, never the quota
    return options.map((option) =>
        option.disabledReason === BOWLER_BOWLED_LAST_OVER && option.overs < quota
            ? { ...option, disabledReason: null }
            : option,
    )
}
