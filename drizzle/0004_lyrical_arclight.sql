ALTER TABLE "otp" DROP CONSTRAINT "otp_attempts_max_3";--> statement-breakpoint
ALTER TABLE "otp" ADD CONSTRAINT "otp_attempts_max_5" CHECK ("otp"."attempts" <= 5);