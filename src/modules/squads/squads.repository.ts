import { asc, eq } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { matches, matchPlayers } from "../../db/schema/index.js"

export type PlayerRow = typeof matchPlayers.$inferInsert

export const findMatchPlayers = (matchId: number) =>
    db
        .select({
            id: matchPlayers.id,
            teamId: matchPlayers.teamId,
            squad: matchPlayers.squad,
            position: matchPlayers.position,
            name: matchPlayers.name,
        })
        .from(matchPlayers)
        .where(eq(matchPlayers.matchId, matchId))
        .orderBy(asc(matchPlayers.position))

// Replace every player of a match at once. The match row is locked so two saves cannot mix.
export const replaceMatchPlayers = (matchId: number, rows: PlayerRow[]) =>
    db.transaction(async (tx) => {
        await tx.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1).for("update")
        await tx.delete(matchPlayers).where(eq(matchPlayers.matchId, matchId))
        if (rows.length > 0) await tx.insert(matchPlayers).values(rows)
    })
