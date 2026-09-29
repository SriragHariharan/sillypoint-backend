import { sql } from "drizzle-orm"
import { check, date, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const tournaments = pgTable(
    "tournaments",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        // The user who created the tournament. Restrict: deleting a user never deletes tournaments.
        organizerId: integer("organizer_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        name: varchar("name", { length: 80 }).notNull(),
        // Sanitized HTML from the rich text editor
        description: text("description").notNull().default(""),
        logoUrl: text("logo_url"),
        // Cloudinary id of the logo, kept so the image can be deleted later
        logoPublicId: text("logo_public_id"),
        location: varchar("location", { length: 120 }).notNull(),
        startDate: date("start_date", { mode: "string" }).notNull(),
        endDate: date("end_date", { mode: "string" }).notNull(),
        // Empty = not cancelled. Upcoming / live / completed is worked out from the dates.
        cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("tournaments_organizer_id_idx").on(table.organizerId),
        index("tournaments_start_date_idx").on(table.startDate),
        check("tournaments_dates_order", sql`${table.endDate} >= ${table.startDate}`),
        check("tournaments_name_not_blank", sql`length(btrim(${table.name})) > 0`),
        check("tournaments_location_not_blank", sql`length(btrim(${table.location})) > 0`),
    ],
)
