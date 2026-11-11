ALTER TABLE "tournaments" ADD COLUMN "last_registration_date" date;--> statement-breakpoint
UPDATE "tournaments" SET "last_registration_date" = "start_date";--> statement-breakpoint
ALTER TABLE "tournaments" ALTER COLUMN "last_registration_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_registration_deadline_order" CHECK ("tournaments"."last_registration_date" <= "tournaments"."start_date");
