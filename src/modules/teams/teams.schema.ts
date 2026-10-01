import { z } from "zod"
import { CAPTAIN_NAME_MAX_LENGTH, MOBILE_REGEX, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "./teams.constants.js"

const name = z
    .string({ error: "Team name is required" })
    .trim()
    .min(NAME_MIN_LENGTH, `Team name must be at least ${NAME_MIN_LENGTH} characters`)
    .max(NAME_MAX_LENGTH, `Team name must be at most ${NAME_MAX_LENGTH} characters`)

const captainName = z
    .string({ error: "Captain name is required" })
    .trim()
    .min(1, "Captain name is required")
    .max(CAPTAIN_NAME_MAX_LENGTH, `Captain name must be at most ${CAPTAIN_NAME_MAX_LENGTH} characters`)

const captainMobile = z
    .string({ error: "Captain mobile is required" })
    .trim()
    .regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")

// Create body (multipart, so every value arrives as text). Unknown keys such as manager_id are dropped by zod.
export const createTeamSchema = z.object({
    name,
    captain_name: captainName,
    captain_mobile: captainMobile,
})

// Update body: every field optional (the service checks that something, a field or a logo, was sent)
export const updateTeamSchema = z.object({
    name: name.optional(),
    captain_name: captainName.optional(),
    captain_mobile: captainMobile.optional(),
})

export const teamIdParamsSchema = z.object({
    id: z.coerce.number({ error: "Invalid team id" }).int().positive("Invalid team id"),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
export type TeamIdParams = z.infer<typeof teamIdParamsSchema>
