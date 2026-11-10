import {
    type BALL_WICKET_TYPES,
    type DELIVERY_KINDS,
    type EXTRA_TYPES,
    type INNINGS_END_REASONS,
    type INNINGS_STATUSES,
    type NO_BALL_RUN_KINDS,
    type RETIREMENT_TYPES,
    type WICKET_TYPES,
} from "../../shared/constants/scoring.js"

export type ExtraType = (typeof EXTRA_TYPES)[number]
export type NoBallRunKind = (typeof NO_BALL_RUN_KINDS)[number]
export type BallWicketType = (typeof BALL_WICKET_TYPES)[number]
export type RetirementType = (typeof RETIREMENT_TYPES)[number]
export type WicketType = (typeof WICKET_TYPES)[number]
export type DeliveryKind = (typeof DELIVERY_KINDS)[number]
export type InningsStatus = (typeof INNINGS_STATUSES)[number]
export type InningsEndReason = (typeof INNINGS_END_REASONS)[number]

export type RuleResult<T> = { ok: true; value: T } | { ok: false; message: string }

export const ok = <T>(value: T): RuleResult<T> => ({ ok: true, value })
export const fail = <T = never>(message: string): RuleResult<T> => ({ ok: false, message })

// Who is at the crease and who is bowling. A null means that place is empty and the scorer must pick someone.
export type Crease = {
    strikerId: number | null
    nonStrikerId: number | null
    bowlerId: number | null
}

// The running state of one innings (the cached snapshot kept on the innings row)
export type InningsSnapshot = Crease & {
    runs: number
    wickets: number
    legalBalls: number
    status: InningsStatus
    endReason: InningsEndReason | null
    // Runs the chasing side needs to win; null in the first innings
    target: number | null
}

// What the scorer sends for one ball
export type BallInput = {
    // Runs counted for the ball, not counting the wide / no-ball penalty run. Includes any overthrow runs.
    runs: number
    // The ball (or the overthrow) reached the rope, so those runs were not run
    isBoundary: boolean
    // The part of `runs` that came from an overthrow
    overthrowRuns: number
    extra: { type: ExtraType; runKind: NoBallRunKind } | null
    wicket: { type: BallWicketType; dismissedPlayerId: number | null; fielderId: number | null } | null
}

// One stored delivery (a ball, or a batter retiring) as the engine sees it
export type DeliveryRow = {
    seq: number
    kind: DeliveryKind
    overNumber: number
    // Legal balls completed in that over after this delivery (0-6)
    ballsInOver: number
    isLegal: boolean
    // The crease as it was BEFORE this delivery
    strikerId: number
    nonStrikerId: number
    bowlerId: number
    runsOffBat: number
    isBoundary: boolean
    wides: number
    noBalls: number
    byes: number
    legByes: number
    overthrowRuns: number
    // Runs the batters physically ran (decides the strike change)
    runsRun: number
    isFreeHit: boolean
    wicketType: WicketType | null
    dismissedPlayerId: number | null
    fielderId: number | null
}

// A delivery before it is stored: the service gives it its seq
export type NewDelivery = Omit<DeliveryRow, "seq">

export type PlayerInfo = { id: number; name: string }

// The rules of the match the engine needs
export type MatchRules = {
    oversPerSide: number
    playersPerSide: number
}
