ALTER TABLE "users" ALTER COLUMN "hashed_password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'inactive';