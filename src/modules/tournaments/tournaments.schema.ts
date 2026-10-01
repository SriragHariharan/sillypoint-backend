import { z } from "zod"
import { isRealDate, todayInTimezone } from "../../shared/utils/date.js"
import {
    DESCRIPTION_MAX_HTML_LENGTH,
    LIST_DEFAULT_LIMIT,
    LIST_MAX_LIMIT,
    LOCATION_MAX_LENGTH,
    MAX_TEAMS_PER_REQUEST,
    NAME_MAX_LENGTH,
    NAME_MIN_LENGTH,
    SEARCH_MAX_LENGTH,
    TOURNAMENT_STATUSES,
    TOURNAMENT_TIMEZONE,
} from "./tournaments.constants.js"

const isoDate = (label: string) =>
    z
        .string({ error: `${label} is required` })
        .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be YYYY-MM-DD`)
        .refine(isRealDate, `${label} is not a valid date`)

// The date rules shared by create and reschedule
const withDateRules = <T extends z.ZodType<{ startDate: string; endDate: string }>>(schema: T) =>
    schema
        .refine((body) => body.startDate >= todayInTimezone(TOURNAMENT_TIMEZONE), {
            message: "Start date cannot be in the past",
            path: ["startDate"],
        })
        .refine((body) => body.endDate >= body.startDate, {
            message: "End date must be on or after the start date",
            path: ["endDate"],
        })

// Create body (multipart, so every value arrives as text). The organizer is never read from the body.
export const createTournamentSchema = withDateRules(
    z.object({
        name: z
            .string({ error: "Name is required" })
            .trim()
            .min(NAME_MIN_LENGTH, `Name must be at least ${NAME_MIN_LENGTH} characters`)
            .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
        description: z
            .string()
            .max(DESCRIPTION_MAX_HTML_LENGTH, "Description is too long")
            .default(""),
        location: z
            .string({ error: "Location is required" })
            .trim()
            .min(1, "Location is required")
            .max(LOCATION_MAX_LENGTH, `Location must be at most ${LOCATION_MAX_LENGTH} characters`),
        startDate: isoDate("Start date"),
        endDate: isoDate("End date"),
    }),
)

export const rescheduleTournamentSchema = withDateRules(
    z.object({
        startDate: isoDate("Start date"),
        endDate: isoDate("End date"),
    }),
)

export const tournamentIdParamsSchema = z.object({
    id: z.coerce.number({ error: "Invalid tournament id" }).int().positive("Invalid tournament id"),
})

export const enrolledTeamParamsSchema = tournamentIdParamsSchema.extend({
    teamId: z.coerce.number({ error: "Invalid team id" }).int().positive("Invalid team id"),
})

export const addTeamsSchema = z.object({
    team_ids: z
        .array(z.number({ error: "Invalid team id" }).int("Invalid team id").positive("Invalid team id"), {
            error: "team_ids must be a list of team ids",
        })
        .min(1, "Select at least one team")
        .max(MAX_TEAMS_PER_REQUEST, `You can add at most ${MAX_TEAMS_PER_REQUEST} teams at once`)
        .transform((ids) => [...new Set(ids)]),
})

// List query: every filter is optional
export const listTournamentsQuerySchema = z
    .object({
        q: z
            .string()
            .trim()
            .max(SEARCH_MAX_LENGTH, "Search is too long")
            .optional()
            .transform((value) => value || undefined),
        status: z.enum(TOURNAMENT_STATUSES, { error: "Invalid status" }).optional(),
        startFrom: isoDate("startFrom").optional(),
        startTo: isoDate("startTo").optional(),
        organizerId: z.coerce.number({ error: "Invalid organizerId" }).int().positive("Invalid organizerId").optional(),
        page: z.coerce.number({ error: "Invalid page" }).int().min(1, "Invalid page").default(1),
        limit: z.coerce
            .number({ error: "Invalid limit" })
            .int()
            .min(1, "Invalid limit")
            .max(LIST_MAX_LIMIT, `limit must be at most ${LIST_MAX_LIMIT}`)
            .default(LIST_DEFAULT_LIMIT),
    })
    .refine((query) => !query.startFrom || !query.startTo || query.startFrom <= query.startTo, {
        message: "startFrom must be on or before startTo",
        path: ["startFrom"],
    })

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>
export type RescheduleTournamentInput = z.infer<typeof rescheduleTournamentSchema>
export type TournamentIdParams = z.infer<typeof tournamentIdParamsSchema>
export type EnrolledTeamParams = z.infer<typeof enrolledTeamParamsSchema>
export type AddTeamsInput = z.infer<typeof addTeamsSchema>
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>
