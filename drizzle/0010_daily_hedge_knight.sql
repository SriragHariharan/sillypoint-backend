CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(60) NOT NULL,
	"logo_url" text,
	"logo_public_id" text,
	"captain_name" varchar(60) NOT NULL,
	"captain_mobile" varchar(10) NOT NULL,
	"manager_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_not_blank" CHECK (length(btrim("teams"."name")) > 0),
	CONSTRAINT "teams_captain_name_not_blank" CHECK (length(btrim("teams"."captain_name")) > 0),
	CONSTRAINT "teams_captain_mobile_10_digits" CHECK ("teams"."captain_mobile" ~ '^[0-9]{10}$')
);
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teams_manager_id_idx" ON "teams" USING btree ("manager_id");