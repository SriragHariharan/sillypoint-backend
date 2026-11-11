ALTER TABLE "teams" RENAME COLUMN "captain_name" TO "manager_name";--> statement-breakpoint
ALTER TABLE "teams" RENAME COLUMN "captain_mobile" TO "manager_mobile";--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_captain_name_not_blank";--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_captain_mobile_10_digits";--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_name_not_blank" CHECK (length(btrim("teams"."manager_name")) > 0);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_mobile_10_digits" CHECK ("teams"."manager_mobile" ~ '^[0-9]{10}$');
