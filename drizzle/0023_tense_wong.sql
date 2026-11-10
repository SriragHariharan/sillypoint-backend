ALTER TABLE "matches" DROP CONSTRAINT "matches_scorer_valid";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "scorer_name";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scorer_valid" CHECK (("matches"."scorer_link_token" is null) = ("matches"."scorer_pin" is null));