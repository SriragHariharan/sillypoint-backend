import { z } from "zod"
import { isRealDate } from "../../shared/utils/date.js"
import { INVALID_STAGE, MATCH_STAGES, NOTES_MAX_LENGTH, SAME_TEAM } from "./matches.constants.js"

const teamId = (label: string) =>
    z.number({ error: `${label} is required` }).int(`${label} is invalid`).positive(`${label} is invalid`)

const matchDate = z
    .string({ error: "Match date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Match date must be YYYY-MM-DD")
    .refine(isRealDate, "Match date is not a valid date")

const matchTime = z
    .string({ error: "Match time is required" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Match time must be HH:mm")

export const matchIdParamsSchema = z.object({
    id: z.coerce.number({ error: "Invalid match id" }).int().positive("Invalid match id"),
})

export const rescheduleMatchSchema = z.object({ matchDate, matchTime })

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
export type MatchIdParams = z.infer<typeof matchIdParamsSchema>
