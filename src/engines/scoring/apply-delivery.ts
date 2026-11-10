import {
    BALLS_PER_OVER,
    EITHER_END_WICKET_TYPES,
    FIELDER_ALLOWED_WICKET_TYPES,
    FIELDER_REQUIRED_WICKET_TYPES,
    FOUR_RUNS,
    MAX_RUNS_PER_BALL,
    NO_BALL_WICKET_TYPES,
    NO_RUNS_WICKET_TYPES,
    OVERTHROW_BOUNDARY_RUNS,
    SIX_RUNS,
    WIDE_WICKET_TYPES,
} from "../../shared/constants/scoring.js"
import { includes, isTeamWicket, totalRunsOf } from "./delivery-math.js"
import { type BatterOption, type BowlerOption, currentOverOf, endReasonOf } from "./innings-state.js"
import {
    BOUNDARY_RUNS_INVALID,
    BOWLER_CHANGE_TOO_LATE,
    BOWLER_NOT_AVAILABLE,
    BYE_RUNS_REQUIRED,
    DISMISSED_MUST_BE_STRIKER,
    DISMISSED_NOT_AT_CREASE,
    DISMISSED_REQUIRED,
    FIELDER_NOT_IN_FIELDING_SIDE,
    FIELDER_REQUIRED,
    INNINGS_OVER,
    INVALID_RUNS,
    NO_EMPTY_BATTER_PLACE,
    NO_RUNS_ON_THIS_WICKET,
    NOTHING_TO_PICK,
    OVERTHROW_BOUNDARY_RUNS_INVALID,
    OVERTHROW_TOO_BIG,
    PICK_BATTER_FIRST,
    PICK_BOWLER_FIRST,
    PLAYER_NOT_AVAILABLE,
    RETIRE_NOT_AT_CREASE,
    RETIRE_WITH_PICK_PENDING,
    SWAP_NEEDS_TWO_BATTERS,
    WICKET_NOT_POSSIBLE_ON_FREE_HIT,
    WICKET_NOT_POSSIBLE_ON_NO_BALL,
    WICKET_NOT_POSSIBLE_ON_WIDE,
} from "./messages.js"
import { ballRunsOf, nextCrease, runsRunOf } from "./rotation.js"
import {
    type BallInput,
    type DeliveryRow,
    fail,
    type InningsSnapshot,
    type MatchRules,
    type NewDelivery,
    ok,
    type RetirementType,
    type RuleResult,
} from "./types.js"

export type BallContext = MatchRules & {
    // The previous ball was a no-ball
    isFreeHit: boolean
    // Everyone in the bowling team's squad (playing and substitutes), who may take a catch or a run out
    fieldingPlayerIds: ReadonlySet<number>
}

export type DeliveryOutcome = { delivery: NewDelivery; snapshot: InningsSnapshot }

// The runs of the ball sorted into the columns they are stored in
const partsOf = ({ runs, extra }: BallInput) => {
    const parts = { runsOffBat: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 }

    if (!extra) parts.runsOffBat = runs
    else if (extra.type === "wide") parts.wides = 1 + runs
    else if (extra.type === "bye") parts.byes = runs
    else if (extra.type === "leg_bye") parts.legByes = runs
    else {
        parts.noBalls = 1
        if (extra.runKind === "bat") parts.runsOffBat = runs
        else if (extra.runKind === "bye") parts.byes = runs
        else parts.legByes = runs
    }

    return parts
}

// The batter and bowler places must be filled before a ball can be recorded
const pendingPick = (snapshot: InningsSnapshot) => {
    if (snapshot.strikerId === null || snapshot.nonStrikerId === null) return PICK_BATTER_FIRST
    if (snapshot.bowlerId === null) return PICK_BOWLER_FIRST
    return null
}

const finish = (snapshot: InningsSnapshot, rules: MatchRules): InningsSnapshot => {
    const endReason = endReasonOf(snapshot, rules)
    return endReason ? { ...snapshot, status: "completed", endReason } : snapshot
}

// Record one ball: checks the cricket rules, works out the new score and who is at the crease
export const applyBall = (snapshot: InningsSnapshot, input: BallInput, ctx: BallContext): RuleResult<DeliveryOutcome> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    const pending = pendingPick(snapshot)
    if (pending) return fail(pending)
    const { strikerId, nonStrikerId, bowlerId } = snapshot
    if (strikerId === null || nonStrikerId === null || bowlerId === null) return fail(PICK_BATTER_FIRST)

    const { extra, wicket, isBoundary, overthrowRuns } = input

    // Runs
    if (input.runs < 0 || input.runs > MAX_RUNS_PER_BALL) return fail(INVALID_RUNS)
    if ((extra?.type === "bye" || extra?.type === "leg_bye") && input.runs < 1) return fail(BYE_RUNS_REQUIRED)

    const parts = partsOf(input)
    const ballRuns = ballRunsOf(parts)
    if (overthrowRuns < 0 || overthrowRuns > ballRuns) return fail(OVERTHROW_TOO_BIG)
    if (isBoundary) {
        if (overthrowRuns > 0) {
            if (overthrowRuns !== OVERTHROW_BOUNDARY_RUNS) return fail(OVERTHROW_BOUNDARY_RUNS_INVALID)
        } else if (!(ballRuns === FOUR_RUNS || (ballRuns === SIX_RUNS && parts.runsOffBat === SIX_RUNS))) {
            return fail(BOUNDARY_RUNS_INVALID)
        }
    }

    // Wicket
    let dismissedPlayerId: number | null = null
    let fielderId: number | null = null
    if (wicket) {
        if (ctx.isFreeHit && !includes(NO_BALL_WICKET_TYPES, wicket.type)) return fail(WICKET_NOT_POSSIBLE_ON_FREE_HIT)
        if (extra?.type === "wide" && !includes(WIDE_WICKET_TYPES, wicket.type)) return fail(WICKET_NOT_POSSIBLE_ON_WIDE)
        if (extra?.type === "no_ball" && !includes(NO_BALL_WICKET_TYPES, wicket.type)) {
            return fail(WICKET_NOT_POSSIBLE_ON_NO_BALL)
        }
        if (includes(NO_RUNS_WICKET_TYPES, wicket.type) && ballRuns > 0) return fail(NO_RUNS_ON_THIS_WICKET)

        if (includes(EITHER_END_WICKET_TYPES, wicket.type)) {
            if (wicket.dismissedPlayerId === null) return fail(DISMISSED_REQUIRED)
            if (wicket.dismissedPlayerId !== strikerId && wicket.dismissedPlayerId !== nonStrikerId) {
                return fail(DISMISSED_NOT_AT_CREASE)
            }
            dismissedPlayerId = wicket.dismissedPlayerId
        } else {
            if (wicket.dismissedPlayerId !== null && wicket.dismissedPlayerId !== strikerId) {
                return fail(DISMISSED_MUST_BE_STRIKER)
            }
            dismissedPlayerId = strikerId
        }

        fielderId = includes(FIELDER_ALLOWED_WICKET_TYPES, wicket.type) ? wicket.fielderId : null
        if (includes(FIELDER_REQUIRED_WICKET_TYPES, wicket.type) && fielderId === null) return fail(FIELDER_REQUIRED)
        if (fielderId !== null && !ctx.fieldingPlayerIds.has(fielderId)) return fail(FIELDER_NOT_IN_FIELDING_SIDE)
    }

    // Where the ball falls in the over
    const isLegal = parts.wides === 0 && parts.noBalls === 0
    const overNumber = currentOverOf(snapshot.legalBalls)
    const legalBalls = snapshot.legalBalls + (isLegal ? 1 : 0)
    const ballsInOver = legalBalls - overNumber * BALLS_PER_OVER
    const overCompleted = isLegal && ballsInOver === BALLS_PER_OVER

    const runsRun = runsRunOf({ ...parts, overthrowRuns, isBoundary })
    const crease = nextCrease(snapshot, { runsRun, dismissedPlayerId, overCompleted })

    const delivery: NewDelivery = {
        kind: "ball",
        overNumber,
        ballsInOver,
        isLegal,
        strikerId,
        nonStrikerId,
        bowlerId,
        ...parts,
        isBoundary,
        overthrowRuns,
        runsRun,
        isFreeHit: ctx.isFreeHit,
        wicketType: wicket ? wicket.type : null,
        dismissedPlayerId,
        fielderId,
    }

    const next: InningsSnapshot = {
        ...snapshot,
        ...crease,
        runs: snapshot.runs + totalRunsOf(parts),
        wickets: snapshot.wickets + (wicket ? 1 : 0),
        legalBalls,
    }

    return ok({ delivery, snapshot: finish(next, ctx) })
}

// A batter leaves the crease between balls (retired hurt may return later; retired out counts as a wicket)
export const applyRetirement = (
    snapshot: InningsSnapshot,
    input: { playerId: number; type: RetirementType },
    rules: MatchRules,
): RuleResult<DeliveryOutcome> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    const { strikerId, nonStrikerId, bowlerId } = snapshot
    if (strikerId === null || nonStrikerId === null || bowlerId === null) return fail(RETIRE_WITH_PICK_PENDING)
    if (input.playerId !== strikerId && input.playerId !== nonStrikerId) return fail(RETIRE_NOT_AT_CREASE)

    const overNumber = currentOverOf(snapshot.legalBalls)
    const delivery: NewDelivery = {
        kind: "retirement",
        overNumber,
        ballsInOver: snapshot.legalBalls - overNumber * BALLS_PER_OVER,
        isLegal: false,
        strikerId,
        nonStrikerId,
        bowlerId,
        runsOffBat: 0,
        isBoundary: false,
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0,
        overthrowRuns: 0,
        runsRun: 0,
        isFreeHit: false,
        wicketType: input.type,
        dismissedPlayerId: input.playerId,
        fielderId: null,
    }

    const crease = nextCrease(snapshot, { runsRun: 0, dismissedPlayerId: input.playerId, overCompleted: false })
    const next: InningsSnapshot = {
        ...snapshot,
        ...crease,
        wickets: snapshot.wickets + (isTeamWicket(input.type) ? 1 : 0),
    }

    return ok({ delivery, snapshot: finish(next, rules) })
}

// Put the chosen batter into the empty place at the crease
export const selectBatter = (
    snapshot: InningsSnapshot,
    playerId: number,
    options: readonly BatterOption[],
): RuleResult<InningsSnapshot> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    if (snapshot.strikerId !== null && snapshot.nonStrikerId !== null) return fail(NO_EMPTY_BATTER_PLACE)
    if (!options.some((option) => option.id === playerId)) return fail(PLAYER_NOT_AVAILABLE)

    return ok(
        snapshot.strikerId === null ? { ...snapshot, strikerId: playerId } : { ...snapshot, nonStrikerId: playerId },
    )
}

// Choose the bowler of the over that is about to start. It can also be changed until the first ball of the over is bowled.
export const selectBowler = (
    snapshot: InningsSnapshot,
    playerId: number,
    options: readonly BowlerOption[],
    ballsBowledInOver: number,
): RuleResult<InningsSnapshot> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    if (ballsBowledInOver > 0) return fail(BOWLER_CHANGE_TOO_LATE)

    const option = options.find((candidate) => candidate.id === playerId)
    if (!option) return fail(NOTHING_TO_PICK)
    if (option.disabledReason) return fail(`${BOWLER_NOT_AVAILABLE}: ${option.name} ${option.disabledReason}`)

    return ok({ ...snapshot, bowlerId: playerId })
}

// The two batters change ends (used when the scorer notices they are at the wrong ends)
export const swapStrike = (snapshot: InningsSnapshot): RuleResult<InningsSnapshot> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    if (snapshot.strikerId === null || snapshot.nonStrikerId === null) return fail(SWAP_NEEDS_TWO_BATTERS)
    return ok({ ...snapshot, strikerId: snapshot.nonStrikerId, nonStrikerId: snapshot.strikerId })
}

// Take back the last delivery: the score and the crease go back to how they were before it
export const undoDelivery = (snapshot: InningsSnapshot, row: DeliveryRow): InningsSnapshot => ({
    ...snapshot,
    strikerId: row.strikerId,
    nonStrikerId: row.nonStrikerId,
    bowlerId: row.bowlerId,
    runs: snapshot.runs - totalRunsOf(row),
    wickets: snapshot.wickets - (isTeamWicket(row.wicketType) ? 1 : 0),
    legalBalls: snapshot.legalBalls - (row.isLegal ? 1 : 0),
    status: "in_progress",
    endReason: null,
})

// The scorer ends the innings (for example the match is called off or the side declares)
export const endInnings = (snapshot: InningsSnapshot): RuleResult<InningsSnapshot> => {
    if (snapshot.status !== "in_progress") return fail(INNINGS_OVER)
    return ok({ ...snapshot, status: "completed", endReason: "ended_by_scorer" })
}
