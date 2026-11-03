import { z } from "zod"
import { PLAYING_XI_SIZE, SUBSTITUTES_SIZE } from "../../shared/constants/squads.js"
import { DUPLICATE_PLAYER, PLAYER_NAME_MAX_LENGTH } from "./squads.constants.js"

const player = z.object({
    name: z
        .string({ error: "Player name is required" })
        .trim()
        .min(1, "Player name is required")
        .max(PLAYER_NAME_MAX_LENGTH, `Player name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`),
})

// One team's players. Fewer than 11 + 4 is allowed (the scorer can fill the rest in later); the array order is the position.
const teamSquad = z
    .object({
        playing: z.array(player).max(PLAYING_XI_SIZE, `At most ${PLAYING_XI_SIZE} playing players per team`),
        substitutes: z.array(player).max(SUBSTITUTES_SIZE, `At most ${SUBSTITUTES_SIZE} substitutes per team`),
    })
    .refine(
        (squad) => {
            const names = [...squad.playing, ...squad.substitutes].map((entry) => entry.name.toLowerCase())
            return new Set(names).size === names.length
        },
        { message: DUPLICATE_PLAYER },
    )

export const saveSquadsSchema = z.object({ teamA: teamSquad, teamB: teamSquad })

export type SaveSquadsInput = z.infer<typeof saveSquadsSchema>
