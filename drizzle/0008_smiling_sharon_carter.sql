CREATE TABLE "tournaments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tournaments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizer_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"logo_public_id" text,
	"location" varchar(120) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_dates_order" CHECK ("tournaments"."end_date" >= "tournaments"."start_date"),
	CONSTRAINT "tournaments_name_not_blank" CHECK (length(btrim("tournaments"."name")) > 0),
	CONSTRAINT "tournaments_location_not_blank" CHECK (length(btrim("tournaments"."location")) > 0)
);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournaments_organizer_id_idx" ON "tournaments" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "tournaments_start_date_idx" ON "tournaments" USING btree ("start_date");