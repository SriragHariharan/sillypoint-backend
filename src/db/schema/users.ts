import { sql } from "drizzle-orm"
import { check, integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"

export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "blocked"])

export const users = pgTable(
    "users",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        mobile: varchar("mobile", { length: 10 }).notNull().unique(),
        hashedPassword: text("hashed_password").notNull(),
        status: userStatusEnum("status").notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [check("mobile_10_digits", sql`${table.mobile} ~ '^[0-9]{10}$'`)],
)
