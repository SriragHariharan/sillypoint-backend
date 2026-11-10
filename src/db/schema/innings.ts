import { sql } from "drizzle-orm"
import { check, integer, pgTable, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import {
    INNINGS_END_REASON_MAX_LENGTH,
    INNINGS_END_REASONS,
    INNINGS_STATUS_MAX_LENGTH,
    INNINGS_STATUSES,
} from "../../shared/constants/scoring.js"
import { matchPlayers } from "./match-players.js"
import { matches } from "./matches.js"
import { teams } from "./teams.js"

const oneOf = (values: readonly string[]) => sql.join(values.map((value) => sql.raw(`'${value}'`)), sql`, `)

// One innings of a match: which side bats, plus a small snapshot of the score and the crease that is updated
// together with every delivery (the deliveries table is the source of truth, the snapshot makes resuming cheap)
export const innings = pgTable(
    "innings",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // Restrict: an innings never deletes a match, a team or a player
        matchId: integer("match_id")
            .notNull()
            .references(() => matches.id, { onDelete: "restrict" }),
        // 1 or 2
        inningsNumber: smallint("innings_number").notNull(),
        battingTeamId: integer("batting_team_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        bowlingTeamId: integer("bowling_team_id")
            .notNull()
            .references(() => teams.id, { onDelete: "restrict" }),
        status: varchar("status", { length: INNINGS_STATUS_MAX_LENGTH }).notNull().default("in_progress"),
        // Set together with completed_at when the innings is over
        endReason: varchar("end_reason", { length: INNINGS_END_REASON_MAX_LENGTH }),
        // Runs the chasing side needs (first innings runs + 1); null in the first innings
        target: integer("target"),
        runs: integer("runs").notNull().default(0),
        wickets: integer("wickets").notNull().default(0),
        legalBalls: integer("legal_balls").notNull().default(0),
        // Who is at the crease and bowling; null means the place is empty and the scorer must choose someone
        strikerId: integer("striker_id").references(() => matchPlayers.id, { onDelete: "restrict" }),
        nonStrikerId: integer("non_striker_id").references(() => matchPlayers.id, { onDelete: "restrict" }),
        bowlerId: integer("bowler_id").references(() => matchPlayers.id, { onDelete: "restrict" }),
        // Goes up by one with every change; the scorer's screen sends the version it saw so a stale or repeated tap is rejected
        version: integer("version").notNull().default(0),
        startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("innings_match_number_uidx").on(table.matchId, table.inningsNumber),
        check("innings_number_valid", sql`${table.inningsNumber} in (1, 2)`),
        check("innings_teams_differ", sql`${table.battingTeamId} <> ${table.bowlingTeamId}`),
        check("innings_status_valid", sql`${table.status} in (${oneOf(INNINGS_STATUSES)})`),
        check(
            "innings_end_reason_valid",
            sql`${table.endReason} is null or ${table.endReason} in (${oneOf(INNINGS_END_REASONS)})`,
        ),
        check(
            "innings_completed_valid",
            sql`(${table.status} = 'completed') = (${table.completedAt} is not null) and (${table.status} = 'completed') = (${table.endReason} is not null)`,
        ),
        check(
            "innings_totals_valid",
            sql`${table.runs} >= 0 and ${table.wickets} >= 0 and ${table.legalBalls} >= 0 and ${table.version} >= 0 and (${table.target} is null or ${table.target} >= 1)`,
        ),
        check(
            "innings_crease_valid",
            sql`${table.strikerId} is null or ${table.nonStrikerId} is null or ${table.strikerId} <> ${table.nonStrikerId}`,
        ),
    ],
)
