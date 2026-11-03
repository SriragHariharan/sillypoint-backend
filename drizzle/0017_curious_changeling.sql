CREATE TABLE "match_players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"squad" varchar(10) NOT NULL,
	"position" smallint NOT NULL,
	"name" varchar(60) NOT NULL,
	"role" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_players_name_not_blank" CHECK (length(btrim("match_players"."name")) > 0),
	CONSTRAINT "match_players_role_valid" CHECK ("match_players"."role" in ('batter', 'bowler', 'all_rounder', 'wicketkeeper')),
	CONSTRAINT "match_players_squad_valid" CHECK ("match_players"."squad" in ('playing', 'substitute')),
	CONSTRAINT "match_players_position_valid" CHECK (("match_players"."squad" = 'playing' and "match_players"."position" between 1 and 11) or ("match_players"."squad" = 'substitute' and "match_players"."position" between 1 and 4))
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "toss_winner_team_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "toss_decision" varchar(4);--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_match_id_idx" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_slot_uidx" ON "match_players" USING btree ("match_id","team_id","squad","position");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_toss_winner_team_id_teams_id_fk" FOREIGN KEY ("toss_winner_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_toss_valid" CHECK (("matches"."toss_winner_team_id" is null and "matches"."toss_decision" is null) or ("matches"."toss_winner_team_id" in ("matches"."team_a_id", "matches"."team_b_id") and "matches"."toss_decision" in ('bat', 'bowl')));