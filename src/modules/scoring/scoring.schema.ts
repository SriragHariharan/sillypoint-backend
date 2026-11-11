import { z } from "zod"
import {
    BALL_WICKET_TYPES,
    EXTRA_TYPES,
    MAX_INNINGS,
    MAX_RUNS_PER_BALL,
    NO_BALL_RUN_KINDS,
    RETIREMENT_TYPES,
} from "../../shared/constants/scoring.js"

const playerId = (label: string) =>
    z.number({ error: `${label} is required` }).int(`${label} is invalid`).positive(`${label} is invalid`)

const expectedVersion = z
    .number({ error: "The score version is required" })
    .int("The score version is invalid")
    .min(0, "The score version is invalid")

const runs = (label: string) =>
    z
        .number({ error: `${label} must be a number` })
        .int(`${label} must be a whole number`)
        .min(0, `${label} cannot be negative`)
        .max(MAX_RUNS_PER_BALL, `${label} cannot be more than ${MAX_RUNS_PER_BALL}`)

export const inningsParamsSchema = z.object({
    n: z.coerce.number({ error: "Innings is invalid" }).int("Innings is invalid").min(1, "Innings is invalid").max(MAX_INNINGS, "Innings is invalid"),
})

export const startInningsSchema = z
    .object({
        strikerId: playerId("Striker"),
        nonStrikerId: playerId("Non-striker"),
        bowlerId: playerId("Bowler"),
    })
    .refine((value) => value.strikerId !== value.nonStrikerId, { message: "Choose two different opening batters" })

// One ball. `runs` is every run counted for the ball (not counting the wide / no-ball penalty run) and already
// includes any overthrow runs; `overthrowRuns` says how many of them came from the overthrow.
export const recordBallSchema = z.object({
    expectedVersion,
    runs: runs("Runs").default(0),
    isBoundary: z.boolean({ error: "Boundary must be true or false" }).default(false),
    overthrowRuns: runs("Overthrow runs").default(0),
    extra: z
        .object({
            type: z.enum(EXTRA_TYPES, { error: "Choose wide, no ball, bye or leg bye" }),
            // What the runs on a no-ball were (off the bat, byes or leg byes); ignored for the other extras
            runKind: z.enum(NO_BALL_RUN_KINDS, { error: "Choose bat, byes or leg byes" }).default("bat"),
        })
        .nullish(),
    wicket: z
        .object({
            type: z.enum(BALL_WICKET_TYPES, { error: "Choose how the batter is out" }),
            dismissedPlayerId: playerId("Batter").nullish(),
            fielderId: playerId("Fielder").nullish(),
        })
        .nullish(),
})

export const chooseBatterSchema = z.object({ expectedVersion, playerId: playerId("Batter") })
export const chooseBowlerSchema = z.object({ expectedVersion, playerId: playerId("Bowler") })
export const versionOnlySchema = z.object({ expectedVersion })
export const retireSchema = z.object({
    expectedVersion,
    playerId: playerId("Batter"),
    type: z.enum(RETIREMENT_TYPES, { error: "Choose retired hurt or retired out" }),
})

export type InningsParams = z.infer<typeof inningsParamsSchema>
export type StartInningsInput = z.infer<typeof startInningsSchema>
export type RecordBallInput = z.infer<typeof recordBallSchema>
export type ChooseBatterInput = z.infer<typeof chooseBatterSchema>
export type ChooseBowlerInput = z.infer<typeof chooseBowlerSchema>
export type VersionOnlyInput = z.infer<typeof versionOnlySchema>
export type RetireInput = z.infer<typeof retireSchema>
