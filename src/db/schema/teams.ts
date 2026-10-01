import { sql } from "drizzle-orm"
import { check, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const teams = pgTable(
    "teams",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        name: varchar("name", { length: 60 }).notNull(),
        logoUrl: text("logo_url"),
        // Cloudinary id of the logo, kept so the image can be deleted later
        logoPublicId: text("logo_public_id"),
        captainName: varchar("captain_name", { length: 60 }).notNull(),
        captainMobile: varchar("captain_mobile", { length: 10 }).notNull(),
        // The user who manages the team. Restrict: deleting a user never deletes teams.
        managerId: integer("manager_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("teams_manager_id_idx").on(table.managerId),
        check("teams_name_not_blank", sql`length(btrim(${table.name})) > 0`),
        check("teams_captain_name_not_blank", sql`length(btrim(${table.captainName})) > 0`),
        check("teams_captain_mobile_10_digits", sql`${table.captainMobile} ~ '^[0-9]{10}$'`),
    ],
)
