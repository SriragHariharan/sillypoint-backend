import { z } from "zod"
import { isRealDate } from "../../shared/utils/date.js"
import {
    INVALID_STAGE,
    INVALID_TOSS_DECISION,
    MATCH_STAGES,
    NOTES_MAX_LENGTH,
    SAME_TEAM,
    SCORER_LINK_TOKEN_MAX_LENGTH,
    SCORER_MOBILE_PATTERN,
    SCORER_NAME_MAX_LENGTH,
    SCORER_NAME_MIN_LENGTH,
    SCORER_PIN_LENGTH,
    TOSS_DECISIONS,
} from "./matches.constants.js"

const teamId = (label: string) =>
    z.number({ error: `${label} is required` }).int(`${label} is invalid`).positive(`${label} is invalid`)

const matchDate = z
    .string({ error: "Match date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Match date must be YYYY-MM-DD")
    .refine(isRealDate, "Match date is not a valid date")

const matchTime = z
    .string({ error: "Match time is required" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Match time must be HH:mm")

export const scorerLoginSchema = z.object({
    token: z
        .string({ error: "Link is invalid" })
        .regex(/^[A-Za-z0-9_-]+$/, "Link is invalid")
        .min(20, "Link is invalid")
        .max(SCORER_LINK_TOKEN_MAX_LENGTH, "Link is invalid"),
    mobile: z
        .string({ error: "Scorer mobile is required" })
        .regex(new RegExp(SCORER_MOBILE_PATTERN), "Enter a valid 10-digit Indian mobile number"),
    pin: z
        .string({ error: "PIN is required" })
        .regex(new RegExp(`^[0-9]{${SCORER_PIN_LENGTH}}$`), `PIN must be ${SCORER_PIN_LENGTH} digits`),
})

export const matchIdParamsSchema = z.object({
    id: z.coerce.number({ error: "Invalid match id" }).int().positive("Invalid match id"),
})

export const rescheduleMatchSchema = z.object({ matchDate, matchTime })

export const addScorerSchema = z.object({
    name: z
        .string({ error: "Scorer name is required" })
        .trim()
        .min(SCORER_NAME_MIN_LENGTH, `Scorer name must be at least ${SCORER_NAME_MIN_LENGTH} characters`)
        .max(SCORER_NAME_MAX_LENGTH, `Scorer name must be at most ${SCORER_NAME_MAX_LENGTH} characters`),
    mobile: z
        .string({ error: "Scorer mobile is required" })
        .regex(new RegExp(SCORER_MOBILE_PATTERN), "Enter a valid 10-digit Indian mobile number"),
})

export const setTossSchema = z.object({
    winnerTeamId: teamId("Toss winner"),
    decision: z.enum(TOSS_DECISIONS, { error: INVALID_TOSS_DECISION }),
})

export const createMatchSchema = z
    .object({
        teamAId: teamId("Team A"),
        teamBId: teamId("Team B"),
        matchDate,
        matchTime,
        stage: z
            .enum(MATCH_STAGES, { error: INVALID_STAGE })
            .nullish()
            .transform((value) => value ?? undefined),
        notes: z
            .string()
            .trim()
            .max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters`)
            .optional()
            .transform((value) => value || undefined),
    })
    .refine((body) => body.teamAId !== body.teamBId, { message: SAME_TEAM, path: ["teamBId"] })

export type CreateMatchInput = z.infer<typeof createMatchSchema>
export type RescheduleMatchInput = z.infer<typeof rescheduleMatchSchema>
export type AddScorerInput = z.infer<typeof addScorerSchema>
export type ScorerLoginInput = z.infer<typeof scorerLoginSchema>
export type SetTossInput = z.infer<typeof setTossSchema>
export type MatchIdParams = z.infer<typeof matchIdParamsSchema>
