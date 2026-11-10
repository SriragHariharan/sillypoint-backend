import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import {
    MATCH_STAGES,
    MAX_OVERS_PER_SIDE,
    MIN_OVERS_PER_SIDE,
    SCORER_LINK_TOKEN_MAX_LENGTH,
    SCORER_MOBILE_PATTERN,
    SCORER_NAME_MAX_LENGTH,
    SCORER_PIN_LENGTH,
    STAGE_MAX_LENGTH,
    TOSS_DECISION_MAX_LENGTH,
    TOSS_DECISIONS,
} from "../../modules/matches/matches.constants.js"
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
        // The match's scorer (one per match); both are set together. Not a user account yet.
        scorerName: varchar("scorer_name", { length: SCORER_NAME_MAX_LENGTH }),
        scorerMobile: varchar("scorer_mobile", { length: 10 }),
        // Shareable login link (random token) and 6-digit PIN for the scorer; the organizer can view both
        scorerLinkToken: varchar("scorer_link_token", { length: SCORER_LINK_TOKEN_MAX_LENGTH }).unique(),
        scorerPin: varchar("scorer_pin", { length: SCORER_PIN_LENGTH }),
        // Wrong mobile/PIN tries in a row; at the limit the scorer login is locked until scorer_locked_until
        scorerPinAttempts: integer("scorer_pin_attempts").notNull().default(0),
        scorerLockedUntil: timestamp("scorer_locked_until", { withTimezone: true }),
        // The toss: the winning team (one of the two teams) and what it chose; both are set together
        tossWinnerTeamId: integer("toss_winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
        tossDecision: varchar("toss_decision", { length: TOSS_DECISION_MAX_LENGTH }),
        // Overs each side bats; null until the scorer sets it
        oversPerSide: integer("overs_per_side"),
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
        check(
            "matches_scorer_valid",
            sql`(${table.scorerName} is null and ${table.scorerMobile} is null) or (${table.scorerName} is not null and ${table.scorerMobile} ~ ${sql.raw(`'${SCORER_MOBILE_PATTERN}'`)})`,
        ),
        check(
            "matches_toss_valid",
            sql`(${table.tossWinnerTeamId} is null and ${table.tossDecision} is null) or (${table.tossWinnerTeamId} in (${table.teamAId}, ${table.teamBId}) and ${table.tossDecision} in (${sql.join(TOSS_DECISIONS.map((decision) => sql.raw(`'${decision}'`)), sql`, `)}))`,
        ),
        check(
            "matches_overs_valid",
            sql`${table.oversPerSide} is null or ${table.oversPerSide} between ${sql.raw(String(MIN_OVERS_PER_SIDE))} and ${sql.raw(String(MAX_OVERS_PER_SIDE))}`,
        ),
        check("matches_stage_valid", sql`${table.stage} is null or ${table.stage} in (${sql.join(MATCH_STAGES.map((stage) => sql.raw(`'${stage}'`)), sql`, `)})`),
    ],
)
