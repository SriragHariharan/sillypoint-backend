import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { RESULT_SUMMARY_MAX_LENGTH, RESULT_TYPE_MAX_LENGTH, RESULT_TYPES } from "../../shared/constants/scoring.js"
import {
    MATCH_STAGES,
    MAX_OVERS_PER_SIDE,
    MIN_OVERS_PER_SIDE,
    SCORER_LINK_TOKEN_MAX_LENGTH,
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
        // The scorer's login, created together with the match: a shareable link (random token) and a 6-digit PIN.
        // The PIN is kept as plain text on purpose so the organizer can always view it. No scorer name or account.
        scorerLinkToken: varchar("scorer_link_token", { length: SCORER_LINK_TOKEN_MAX_LENGTH }).unique(),
        scorerPin: varchar("scorer_pin", { length: SCORER_PIN_LENGTH }),
        // Wrong PIN tries in a row; at the limit the scorer login is locked until scorer_locked_until
        scorerPinAttempts: integer("scorer_pin_attempts").notNull().default(0),
        scorerLockedUntil: timestamp("scorer_locked_until", { withTimezone: true }),
        // The toss: the winning team (one of the two teams) and what it chose; both are set together
        tossWinnerTeamId: integer("toss_winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
        tossDecision: varchar("toss_decision", { length: TOSS_DECISION_MAX_LENGTH }),
        // Overs each side bats; null until the scorer sets it
        oversPerSide: integer("overs_per_side"),
        // Set when the first innings starts; from then on the toss, overs and players are locked
        scoringStartedAt: timestamp("scoring_started_at", { withTimezone: true }),
        // The result, set together when the second innings is over: a win (with the winner), a tie or no result
        completedAt: timestamp("completed_at", { withTimezone: true }),
        resultType: varchar("result_type", { length: RESULT_TYPE_MAX_LENGTH }),
        winnerTeamId: integer("winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
        resultSummary: varchar("result_summary", { length: RESULT_SUMMARY_MAX_LENGTH }),
        // Set when the scorer concludes the finished match; from then on scoring (including undo) is locked
        concludedAt: timestamp("concluded_at", { withTimezone: true }),
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
        check("matches_scorer_valid", sql`(${table.scorerLinkToken} is null) = (${table.scorerPin} is null)`),
        check(
            "matches_toss_valid",
            sql`(${table.tossWinnerTeamId} is null and ${table.tossDecision} is null) or (${table.tossWinnerTeamId} in (${table.teamAId}, ${table.teamBId}) and ${table.tossDecision} in (${sql.join(TOSS_DECISIONS.map((decision) => sql.raw(`'${decision}'`)), sql`, `)}))`,
        ),
        check(
            "matches_overs_valid",
            sql`${table.oversPerSide} is null or ${table.oversPerSide} between ${sql.raw(String(MIN_OVERS_PER_SIDE))} and ${sql.raw(String(MAX_OVERS_PER_SIDE))}`,
        ),
        check(
            "matches_result_valid",
            sql`(${table.completedAt} is null and ${table.resultType} is null and ${table.winnerTeamId} is null and ${table.resultSummary} is null) or (${table.completedAt} is not null and ${table.scoringStartedAt} is not null and ${table.resultSummary} is not null and ${table.resultType} in (${sql.join(RESULT_TYPES.map((type) => sql.raw(`'${type}'`)), sql`, `)}) and ((${table.resultType} = 'win' and ${table.winnerTeamId} in (${table.teamAId}, ${table.teamBId})) or (${table.resultType} <> 'win' and ${table.winnerTeamId} is null)))`,
        ),
        check("matches_concluded_valid", sql`${table.concludedAt} is null or ${table.completedAt} is not null`),
        check("matches_stage_valid", sql`${table.stage} is null or ${table.stage} in (${sql.join(MATCH_STAGES.map((stage) => sql.raw(`'${stage}'`)), sql`, `)})`),
    ],
)
