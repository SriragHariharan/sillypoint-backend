import { sql } from "drizzle-orm"
import { boolean, check, index, integer, pgTable, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import {
    DELIVERY_KIND_MAX_LENGTH,
    DELIVERY_KINDS,
    MAX_RUNS_PER_BALL,
    MAX_WIDES_PER_BALL,
    WICKET_TYPE_MAX_LENGTH,
    WICKET_TYPES,
} from "../../shared/constants/scoring.js"
import { innings } from "./innings.js"
import { matchPlayers } from "./match-players.js"
import { matches } from "./matches.js"

const oneOf = (values: readonly string[]) => sql.join(values.map((value) => sql.raw(`'${value}'`)), sql`, `)

// Every ball bowled (and every batter retiring), one row each, never edited or deleted: Undo only sets voided_at.
// The score and the scorecard are worked out from these rows.
export const deliveries = pgTable(
    "deliveries",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // Restrict: a delivery never deletes an innings, a match or a player
        inningsId: integer("innings_id")
            .notNull()
            .references(() => innings.id, { onDelete: "restrict" }),
        // Same as the innings' match, kept here so a whole match is read with one query
        matchId: integer("match_id")
            .notNull()
            .references(() => matches.id, { onDelete: "restrict" }),
        // 1, 2, 3... within the innings (voided rows keep their number); unique, so the same ball cannot be saved twice
        seq: integer("seq").notNull(),
        // A ball, or a batter retiring between balls
        kind: varchar("kind", { length: DELIVERY_KIND_MAX_LENGTH }).notNull().default("ball"),
        // 0-based over, and the legal balls of that over completed after this row (0-6)
        overNumber: smallint("over_number").notNull(),
        ballsInOver: smallint("balls_in_over").notNull(),
        // False for wides, no-balls and retirements: they are not one of the six balls of the over
        isLegal: boolean("is_legal").notNull(),
        // The crease as it was before this delivery (set by the server)
        strikerId: integer("striker_id")
            .notNull()
            .references(() => matchPlayers.id, { onDelete: "restrict" }),
        nonStrikerId: integer("non_striker_id")
            .notNull()
            .references(() => matchPlayers.id, { onDelete: "restrict" }),
        bowlerId: integer("bowler_id")
            .notNull()
            .references(() => matchPlayers.id, { onDelete: "restrict" }),
        // Runs off the bat, overthrow runs included
        runsOffBat: smallint("runs_off_bat").notNull().default(0),
        // The ball (or the overthrow) reached the rope, so those runs were not run
        isBoundary: boolean("is_boundary").notNull().default(false),
        // Extras, each including the penalty run (a wide for 2 more runs is wides = 3; a no-ball is no_balls = 1)
        wides: smallint("wides").notNull().default(0),
        noBalls: smallint("no_balls").notNull().default(0),
        byes: smallint("byes").notNull().default(0),
        legByes: smallint("leg_byes").notNull().default(0),
        // The part of the ball's runs that came from an overthrow (already counted in the columns above)
        overthrowRuns: smallint("overthrow_runs").notNull().default(0),
        // Runs the batters physically ran: an odd number changes the strike (set by the server)
        runsRun: smallint("runs_run").notNull().default(0),
        // The ball after a no-ball (set by the server)
        isFreeHit: boolean("is_free_hit").notNull().default(false),
        wicketType: varchar("wicket_type", { length: WICKET_TYPE_MAX_LENGTH }),
        // The batter who is out (the striker or, for a run out, either batter) or who retired
        dismissedPlayerId: integer("dismissed_player_id").references(() => matchPlayers.id, { onDelete: "restrict" }),
        // The catcher, the keeper who stumped, or the fielder in a run out; a player of the bowling team
        fielderId: integer("fielder_id").references(() => matchPlayers.id, { onDelete: "restrict" }),
        // Set when the scorer takes the delivery back with Undo
        voidedAt: timestamp("voided_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => {
        const ballRuns = sql`${table.runsOffBat} + ${table.byes} + ${table.legByes} + greatest(${table.wides} - 1, 0)`
        return [
            uniqueIndex("deliveries_innings_seq_uidx").on(table.inningsId, table.seq),
            index("deliveries_match_id_idx").on(table.matchId),
            index("deliveries_live_idx")
                .on(table.inningsId, table.seq)
                .where(sql`${table.voidedAt} is null`),
            check("deliveries_kind_valid", sql`${table.kind} in (${oneOf(DELIVERY_KINDS)})`),
            check(
                "deliveries_numbers_valid",
                sql`${table.seq} >= 1 and ${table.overNumber} >= 0 and ${table.ballsInOver} between 0 and 6 and ${table.runsOffBat} between 0 and ${sql.raw(String(MAX_RUNS_PER_BALL))} and ${table.wides} between 0 and ${sql.raw(String(MAX_WIDES_PER_BALL))} and ${table.noBalls} in (0, 1) and ${table.byes} between 0 and ${sql.raw(String(MAX_RUNS_PER_BALL))} and ${table.legByes} between 0 and ${sql.raw(String(MAX_RUNS_PER_BALL))} and ${table.overthrowRuns} between 0 and ${sql.raw(String(MAX_RUNS_PER_BALL))} and ${table.runsRun} >= 0`,
            ),
            check(
                "deliveries_wide_valid",
                sql`${table.wides} = 0 or (${table.runsOffBat} = 0 and ${table.noBalls} = 0 and ${table.byes} = 0 and ${table.legByes} = 0)`,
            ),
            check(
                "deliveries_one_run_kind",
                sql`(${table.runsOffBat} > 0)::int + (${table.byes} > 0)::int + (${table.legByes} > 0)::int <= 1`,
            ),
            check(
                "deliveries_legal_valid",
                sql`${table.isLegal} = (${table.kind} = 'ball' and ${table.wides} = 0 and ${table.noBalls} = 0)`,
            ),
            check("deliveries_overthrow_valid", sql`${table.overthrowRuns} <= ${ballRuns}`),
            check("deliveries_runs_run_valid", sql`${table.runsRun} <= ${ballRuns}`),
            check("deliveries_boundary_valid", sql`not ${table.isBoundary} or ${ballRuns} > 0`),
            check("deliveries_crease_valid", sql`${table.strikerId} <> ${table.nonStrikerId}`),
            check(
                "deliveries_wicket_valid",
                sql`(${table.wicketType} is null and ${table.dismissedPlayerId} is null and ${table.fielderId} is null) or (${table.wicketType} in (${oneOf(WICKET_TYPES)}) and ${table.dismissedPlayerId} is not null)`,
            ),
            check(
                "deliveries_retirement_valid",
                sql`(${table.kind} = 'retirement') = coalesce(${table.wicketType} in ('retired_hurt', 'retired_out'), false)`,
            ),
            check(
                "deliveries_retirement_empty",
                sql`${table.kind} = 'ball' or (${table.runsOffBat} = 0 and ${table.wides} = 0 and ${table.noBalls} = 0 and ${table.byes} = 0 and ${table.legByes} = 0 and ${table.overthrowRuns} = 0 and ${table.runsRun} = 0 and not ${table.isBoundary} and not ${table.isFreeHit})`,
            ),
            check(
                "deliveries_free_hit_valid",
                sql`not ${table.isFreeHit} or ${table.wicketType} is null or ${table.wicketType} in ('run_out', 'obstructing_field')`,
            ),
        ]
    },
)
