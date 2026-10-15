import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { MATCH_STAGES, STAGE_MAX_LENGTH } from "../../modules/matches/matches.constants.js"
import { teams } from "./teams.js"
import { tournaments } from "./tournaments.js"
import { users } from "./users.js"

export const matches = pgTable(
    "matches",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // Restrict: a match never deletes a tournament, a team or a user
        tournamentId: integer("tournament_id")
            .notNull()
            .references(() => tournaments.id, { onDelete: "restrict" }),
        teamAId: integer("team_a_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        teamBId: integer("team_b_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        // Start of the match as an exact moment; entered as a date and time in the tournament time zone
        scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
        // Optional label such as semi_final. Empty = no label (every match created before labels existed).
        stage: varchar("stage", { length: STAGE_MAX_LENGTH }),
        // Optional organizer note about the match
        notes: text("notes"),
        createdBy: integer("created_by")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("matches_tournament_scheduled_idx").on(table.tournamentId, table.scheduledAt),
        index("matches_team_a_id_idx").on(table.teamAId),
        index("matches_team_b_id_idx").on(table.teamBId),
        check("matches_teams_differ", sql`${table.teamAId} <> ${table.teamBId}`),
        check("matches_stage_valid", sql`${table.stage} is null or ${table.stage} in (${sql.join(MATCH_STAGES.map((stage) => sql.raw(`'${stage}'`)), sql`, `)})`),
    ],
)
