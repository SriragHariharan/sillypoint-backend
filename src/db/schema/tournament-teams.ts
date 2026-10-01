import { index, integer, pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { teams } from "./teams.js"
import { tournaments } from "./tournaments.js"
import { users } from "./users.js"

export const tournamentTeams = pgTable(
    "tournament_teams",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // Restrict: an enrollment never deletes a tournament, a team or a user
        tournamentId: integer("tournament_id")
            .notNull()
            .references(() => tournaments.id, { onDelete: "restrict" }),
        teamId: integer("team_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        // The user who enrolled the team, so removal can be limited to them and the organizer
        addedBy: integer("added_by")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("tournament_teams_tournament_team_uidx").on(table.tournamentId, table.teamId),
        index("tournament_teams_team_id_idx").on(table.teamId),
    ],
)
