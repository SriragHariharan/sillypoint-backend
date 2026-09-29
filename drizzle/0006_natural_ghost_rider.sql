ALTER TABLE "otp" ALTER COLUMN "purpose" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."otp_purpose";--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('signup', 'login');--> statement-breakpoint
ALTER TABLE "otp" ALTER COLUMN "purpose" SET DATA TYPE "public"."otp_purpose" USING "purpose"::"public"."otp_purpose";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "hashed_password";