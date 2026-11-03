ALTER TABLE "tournaments" ADD COLUMN "players_per_side" integer DEFAULT 11 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "substitutes_per_side" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_players_per_side_range" CHECK ("tournaments"."players_per_side" between 5 and 11);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_substitutes_per_side_range" CHECK ("tournaments"."substitutes_per_side" between 0 and 4);