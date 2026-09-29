import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        familyId: uuid("family_id").notNull(),
        tokenHash: text("token_hash").notNull().unique(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }).notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("refresh_tokens_user_id_idx").on(table.userId), index("refresh_tokens_family_id_idx").on(table.familyId)],
)
