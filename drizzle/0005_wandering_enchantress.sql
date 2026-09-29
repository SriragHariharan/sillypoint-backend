ALTER TABLE "otp" ADD COLUMN "resend_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "otp" ADD CONSTRAINT "otp_resend_count_max_5" CHECK ("otp"."resend_count" <= 5);