import { sql } from "drizzle-orm"
import { check, date, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { PLAYING_XI_SIZE, SUBSTITUTES_SIZE } from "../../shared/constants/squads.js"
import { MIN_PLAYERS_PER_SIDE, MIN_SUBSTITUTES_PER_SIDE } from "../../modules/tournaments/tournaments.constants.js"
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
        // Teams can be added up to and including this day; fixed when the tournament is created
        lastRegistrationDate: date("last_registration_date", { mode: "string" }).notNull(),
        // Whole rupees. The registration fee is fixed when the tournament is created; only the prize money can change.
        registrationFee: integer("registration_fee").notNull().default(0),
        prizeMoney: integer("prize_money").notNull().default(0),
        // Players and substitutes each team names for a match (the scorer cannot enter more). Fixed when the tournament is created.
        playersPerSide: integer("players_per_side").notNull().default(PLAYING_XI_SIZE),
        substitutesPerSide: integer("substitutes_per_side").notNull().default(SUBSTITUTES_SIZE),
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
        check("tournaments_registration_deadline_order", sql`${table.lastRegistrationDate} <= ${table.startDate}`),
        check("tournaments_registration_fee_non_negative", sql`${table.registrationFee} >= 0`),
        check("tournaments_prize_money_non_negative", sql`${table.prizeMoney} >= 0`),
        check(
            "tournaments_players_per_side_range",
            sql`${table.playersPerSide} between ${sql.raw(String(MIN_PLAYERS_PER_SIDE))} and ${sql.raw(String(PLAYING_XI_SIZE))}`,
        ),
        check(
            "tournaments_substitutes_per_side_range",
            sql`${table.substitutesPerSide} between ${sql.raw(String(MIN_SUBSTITUTES_PER_SIDE))} and ${sql.raw(String(SUBSTITUTES_SIZE))}`,
        ),
        check("tournaments_name_not_blank", sql`length(btrim(${table.name})) > 0`),
        check("tournaments_location_not_blank", sql`length(btrim(${table.location})) > 0`),
    ],
)
