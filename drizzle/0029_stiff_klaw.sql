ALTER TABLE "innings" DROP CONSTRAINT "innings_number_valid";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "decided_by" varchar(20);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_decided_by_valid" CHECK ("matches"."decided_by" is null or ("matches"."result_type" = 'win' and "matches"."decided_by" in ('super_over', 'boundary_count')));--> statement-breakpoint
ALTER TABLE "innings" ADD CONSTRAINT "innings_number_valid" CHECK ("innings"."innings_number" between 1 and 4);