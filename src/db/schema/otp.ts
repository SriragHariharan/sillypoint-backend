import { sql } from "drizzle-orm"
import { check, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const otpPurposeEnum = pgEnum("otp_purpose", ["signup", "password_reset"])

export const otp = pgTable(
    "otp",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        otpHash: text("otp_hash").notNull(),
        purpose: otpPurposeEnum("purpose").notNull(),
        attempts: integer("attempts").notNull().default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    },
    (table) => [
        index("otp_user_id_idx").on(table.userId),
        check("otp_attempts_max_3", sql`${table.attempts} <= 3`),
    ],
)
