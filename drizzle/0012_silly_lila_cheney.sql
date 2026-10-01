ALTER TABLE "tournaments" ADD COLUMN "registration_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "prize_money" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_registration_fee_non_negative" CHECK ("tournaments"."registration_fee" >= 0);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_prize_money_non_negative" CHECK ("tournaments"."prize_money" >= 0);