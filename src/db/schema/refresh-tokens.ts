/**
 * REFRESH TOKENS - how the login session works
 * ============================================================================
 *
 * WHAT THIS TABLE IS
 *   One row for every refresh token ever issued. The access token (15 min) is
 *   stateless, so the server cannot cancel it. The refresh token (7 days) is the
 *   part the server CAN control, and this table is how it remembers each one.
 *
 * HOW A LOGIN SESSION LIVES
 *   1. LOGIN (verify-otp): a new family_id is created and the first token is saved.
 *   2. REFRESH (POST /refresh): the token that was sent is marked as used
 *      (revoked_at is set) and a NEW token is saved in the SAME family.
 *      This is called rotation: every refresh token works only once.
 *   3. LOGOUT (POST /logout): revoked_at is set on EVERY token of that family,
 *      so nothing from that login works any more.
 *
 * STOLEN TOKEN PROTECTION (reuse detection)
 *   A token that is already used (revoked_at is set) should never come back.
 *   - Comes back within 10 seconds (REFRESH_REUSE_GRACE_SECONDS): treated as a
 *     harmless double request (two tabs, double click). It just fails.
 *   - Comes back later: it was probably copied by someone else. The WHOLE family
 *     is revoked, so the thief and the real user are both logged out and the
 *     real user logs in again with an OTP.
 *   Different devices have different families, so they never affect each other.
 *
 * SECURITY AND LIMITS
 *   - Only a SHA-256 hash of the token is stored, never the token itself.
 *   - Each token lives 7 days (REFRESH_TOKEN_TTL_SECONDS).
 *   - A login can never last longer than 30 days (SESSION_MAX_AGE_SECONDS),
 *     even if the user keeps refreshing. All limits are in auth.constants.ts.
 *
 * CLEANUP
 *   Used tokens are kept on purpose (they are needed for reuse detection) until
 *   they expire. Expired rows of a user are deleted the next time that user logs
 *   in (deleteExpiredRefreshTokens). Deleting a user deletes their rows too.
 *
 * WHERE THE LOGIC LIVES
 *   src/modules/auth/session.service.ts     issue, refresh (rotate), logout
 *   src/modules/auth/session.repository.ts  the database queries for this table
 */
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./users.js"

export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        // Row number, given by the database. Used to point at one exact token row.
        id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

        // The user this token belongs to. The row is deleted when the user is deleted.
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        // One random id per login (per device). Every token created by refreshing that
        // login shares it. Lets the server end the whole login in one step: on logout,
        // or when a stolen token is detected.
        familyId: uuid("family_id").notNull(),

        // SHA-256 hash of the refresh token (the token itself is never saved). The server
        // finds a token by its hash, and a leaked database gives nobody a usable token.
        // Unique, so two rows can never hold the same token.
        tokenHash: text("token_hash").notNull().unique(),

        // When THIS token stops working (7 days after it was created, and never later
        // than session_expires_at). Old tokens die on their own.
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

        // When the WHOLE login ends (30 days after the first login). Copied unchanged to
        // every rotated token, so refreshing again and again cannot extend it. After this
        // the user must log in with an OTP again.
        sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }).notNull(),

        // Empty = the token can still be used once.
        // Filled = the token is finished: it was already used to refresh, or its whole
        // session was ended (logout, theft detected, user blocked). Kept, not deleted,
        // so a reused old token can be spotted.
        revokedAt: timestamp("revoked_at", { withTimezone: true }),

        // When this token was issued. For debugging and auditing only.
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        // Fast lookup by user: cleaning up one user's expired tokens at login.
        index("refresh_tokens_user_id_idx").on(table.userId),
        // Fast lookup by family: ending a whole session in one update.
        index("refresh_tokens_family_id_idx").on(table.familyId),
    ],
)
