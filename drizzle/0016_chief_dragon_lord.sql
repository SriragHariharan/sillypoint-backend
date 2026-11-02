ALTER TABLE "matches" ADD COLUMN "scorer_link_token" varchar(64);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scorer_pin" varchar(6);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scorer_pin_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scorer_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scorer_link_token_unique" UNIQUE("scorer_link_token");