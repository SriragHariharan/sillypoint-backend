CREATE TABLE "innings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "innings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"innings_number" smallint NOT NULL,
	"batting_team_id" integer NOT NULL,
	"bowling_team_id" integer NOT NULL,
	"status" varchar(12) DEFAULT 'in_progress' NOT NULL,
	"end_reason" varchar(20),
	"target" integer,
	"runs" integer DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"legal_balls" integer DEFAULT 0 NOT NULL,
	"striker_id" integer,
	"non_striker_id" integer,
	"bowler_id" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "innings_number_valid" CHECK ("innings"."innings_number" in (1, 2)),
	CONSTRAINT "innings_teams_differ" CHECK ("innings"."batting_team_id" <> "innings"."bowling_team_id"),
	CONSTRAINT "innings_status_valid" CHECK ("innings"."status" in ('in_progress', 'completed')),
	CONSTRAINT "innings_end_reason_valid" CHECK ("innings"."end_reason" is null or "innings"."end_reason" in ('all_out', 'overs_complete', 'target_reached', 'ended_by_scorer')),
	CONSTRAINT "innings_completed_valid" CHECK (("innings"."status" = 'completed') = ("innings"."completed_at" is not null) and ("innings"."status" = 'completed') = ("innings"."end_reason" is not null)),
	CONSTRAINT "innings_totals_valid" CHECK ("innings"."runs" >= 0 and "innings"."wickets" >= 0 and "innings"."legal_balls" >= 0 and "innings"."version" >= 0 and ("innings"."target" is null or "innings"."target" >= 1)),
	CONSTRAINT "innings_crease_valid" CHECK ("innings"."striker_id" is null or "innings"."non_striker_id" is null or "innings"."striker_id" <> "innings"."non_striker_id")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"innings_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"kind" varchar(12) DEFAULT 'ball' NOT NULL,
	"over_number" smallint NOT NULL,
	"balls_in_over" smallint NOT NULL,
	"is_legal" boolean NOT NULL,
	"striker_id" integer NOT NULL,
	"non_striker_id" integer NOT NULL,
	"bowler_id" integer NOT NULL,
	"runs_off_bat" smallint DEFAULT 0 NOT NULL,
	"is_boundary" boolean DEFAULT false NOT NULL,
	"wides" smallint DEFAULT 0 NOT NULL,
	"no_balls" smallint DEFAULT 0 NOT NULL,
	"byes" smallint DEFAULT 0 NOT NULL,
	"leg_byes" smallint DEFAULT 0 NOT NULL,
	"overthrow_runs" smallint DEFAULT 0 NOT NULL,
	"runs_run" smallint DEFAULT 0 NOT NULL,
	"is_free_hit" boolean DEFAULT false NOT NULL,
	"wicket_type" varchar(20),
	"dismissed_player_id" integer,
	"fielder_id" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_kind_valid" CHECK ("deliveries"."kind" in ('ball', 'retirement')),
	CONSTRAINT "deliveries_numbers_valid" CHECK ("deliveries"."seq" >= 1 and "deliveries"."over_number" >= 0 and "deliveries"."balls_in_over" between 0 and 6 and "deliveries"."runs_off_bat" between 0 and 9 and "deliveries"."wides" between 0 and 10 and "deliveries"."no_balls" in (0, 1) and "deliveries"."byes" between 0 and 9 and "deliveries"."leg_byes" between 0 and 9 and "deliveries"."overthrow_runs" between 0 and 9 and "deliveries"."runs_run" >= 0),
	CONSTRAINT "deliveries_wide_valid" CHECK ("deliveries"."wides" = 0 or ("deliveries"."runs_off_bat" = 0 and "deliveries"."no_balls" = 0 and "deliveries"."byes" = 0 and "deliveries"."leg_byes" = 0)),
	CONSTRAINT "deliveries_one_run_kind" CHECK (("deliveries"."runs_off_bat" > 0)::int + ("deliveries"."byes" > 0)::int + ("deliveries"."leg_byes" > 0)::int <= 1),
	CONSTRAINT "deliveries_legal_valid" CHECK ("deliveries"."is_legal" = ("deliveries"."kind" = 'ball' and "deliveries"."wides" = 0 and "deliveries"."no_balls" = 0)),
	CONSTRAINT "deliveries_overthrow_valid" CHECK ("deliveries"."overthrow_runs" <= "deliveries"."runs_off_bat" + "deliveries"."byes" + "deliveries"."leg_byes" + greatest("deliveries"."wides" - 1, 0)),
	CONSTRAINT "deliveries_runs_run_valid" CHECK ("deliveries"."runs_run" <= "deliveries"."runs_off_bat" + "deliveries"."byes" + "deliveries"."leg_byes" + greatest("deliveries"."wides" - 1, 0)),
	CONSTRAINT "deliveries_boundary_valid" CHECK (not "deliveries"."is_boundary" or "deliveries"."runs_off_bat" + "deliveries"."byes" + "deliveries"."leg_byes" + greatest("deliveries"."wides" - 1, 0) > 0),
	CONSTRAINT "deliveries_crease_valid" CHECK ("deliveries"."striker_id" <> "deliveries"."non_striker_id"),
	CONSTRAINT "deliveries_wicket_valid" CHECK (("deliveries"."wicket_type" is null and "deliveries"."dismissed_player_id" is null and "deliveries"."fielder_id" is null) or ("deliveries"."wicket_type" in ('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing_field', 'retired_hurt', 'retired_out') and "deliveries"."dismissed_player_id" is not null)),
	CONSTRAINT "deliveries_retirement_valid" CHECK (("deliveries"."kind" = 'retirement') = coalesce("deliveries"."wicket_type" in ('retired_hurt', 'retired_out'), false)),
	CONSTRAINT "deliveries_retirement_empty" CHECK ("deliveries"."kind" = 'ball' or ("deliveries"."runs_off_bat" = 0 and "deliveries"."wides" = 0 and "deliveries"."no_balls" = 0 and "deliveries"."byes" = 0 and "deliveries"."leg_byes" = 0 and "deliveries"."overthrow_runs" = 0 and "deliveries"."runs_run" = 0 and not "deliveries"."is_boundary" and not "deliveries"."is_free_hit")),
	CONSTRAINT "deliveries_free_hit_valid" CHECK (not "deliveries"."is_free_hit" or "deliveries"."wicket_type" is null or "deliveries"."wicket_type" in ('run_out', 'obstructing_field'))
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scoring_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "result_type" varchar(10);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "winner_team_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "result_summary" varchar(200);--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_batting_team_id_teams_id_fk" FOREIGN KEY ("batting_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_bowling_team_id_teams_id_fk" FOREIGN KEY ("bowling_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_striker_id_match_players_id_fk" FOREIGN KEY ("striker_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_non_striker_id_match_players_id_fk" FOREIGN KEY ("non_striker_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_bowler_id_match_players_id_fk" FOREIGN KEY ("bowler_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_innings_id_innings_id_fk" FOREIGN KEY ("innings_id") REFERENCES "public"."innings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_striker_id_match_players_id_fk" FOREIGN KEY ("striker_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_non_striker_id_match_players_id_fk" FOREIGN KEY ("non_striker_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_bowler_id_match_players_id_fk" FOREIGN KEY ("bowler_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_dismissed_player_id_match_players_id_fk" FOREIGN KEY ("dismissed_player_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_fielder_id_match_players_id_fk" FOREIGN KEY ("fielder_id") REFERENCES "public"."match_players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "innings_match_number_uidx" ON "innings" USING btree ("match_id","innings_number");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_innings_seq_uidx" ON "deliveries" USING btree ("innings_id","seq");--> statement-breakpoint
CREATE INDEX "deliveries_match_id_idx" ON "deliveries" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "deliveries_live_idx" ON "deliveries" USING btree ("innings_id","seq") WHERE "deliveries"."voided_at" is null;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_result_valid" CHECK (("matches"."completed_at" is null and "matches"."result_type" is null and "matches"."winner_team_id" is null and "matches"."result_summary" is null) or ("matches"."completed_at" is not null and "matches"."scoring_started_at" is not null and "matches"."result_summary" is not null and "matches"."result_type" in ('win', 'tie', 'no_result') and (("matches"."result_type" = 'win' and "matches"."winner_team_id" in ("matches"."team_a_id", "matches"."team_b_id")) or ("matches"."result_type" <> 'win' and "matches"."winner_team_id" is null))));