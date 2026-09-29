import { sql } from "drizzle-orm"
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const otpPurposeEnum = pgEnum("otp_purpose", ["signup", "login"])

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
        resendCount: integer("resend_count").notNull().default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    },
    (table) => [
        index("otp_user_id_idx").on(table.userId),
        uniqueIndex("otp_user_purpose_uidx").on(table.userId, table.purpose),
        check("otp_attempts_max_5", sql`${table.attempts} <= 5`),
        check("otp_resend_count_max_5", sql`${table.resendCount} <= 5`),
    ],
)
