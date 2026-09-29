ALTER TABLE "otp" ADD COLUMN "blocked_until" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "otp_user_purpose_uidx" ON "otp" USING btree ("user_id","purpose");