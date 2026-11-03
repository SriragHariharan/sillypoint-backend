import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { PLAYING_XI_SIZE, SUBSTITUTES_SIZE } from "../../shared/constants/squads.js"
import { PLAYER_NAME_MAX_LENGTH, SQUAD_MAX_LENGTH, SQUADS } from "../../modules/squads/squads.constants.js"
import { matches } from "./matches.js"
import { teams } from "./teams.js"

// The players one team names for one match: 11 playing (in batting order) and 4 substitutes
export const matchPlayers = pgTable(
    "match_players",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // Restrict: a player row never deletes a match or a team
        matchId: integer("match_id")
            .notNull()
            .references(() => matches.id, { onDelete: "restrict" }),
        teamId: integer("team_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        squad: varchar("squad", { length: SQUAD_MAX_LENGTH }).notNull(),
        // Place within the squad: 1-11 for playing (the batting order), 1-4 for substitutes
        position: smallint("position").notNull(),
        name: varchar("name", { length: PLAYER_NAME_MAX_LENGTH }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("match_players_match_id_idx").on(table.matchId),
        uniqueIndex("match_players_slot_uidx").on(table.matchId, table.teamId, table.squad, table.position),
        check("match_players_name_not_blank", sql`length(btrim(${table.name})) > 0`),
        check("match_players_squad_valid", sql`${table.squad} in (${sql.join(SQUADS.map((squad) => sql.raw(`'${squad}'`)), sql`, `)})`),
        check(
            "match_players_position_valid",
            sql`(${table.squad} = 'playing' and ${table.position} between 1 and ${sql.raw(String(PLAYING_XI_SIZE))}) or (${table.squad} = 'substitute' and ${table.position} between 1 and ${sql.raw(String(SUBSTITUTES_SIZE))})`,
        ),
    ],
)
