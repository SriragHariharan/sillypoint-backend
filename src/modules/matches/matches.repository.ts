import { asc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../../db/postgres.js"
import { matches, teams } from "../../db/schema/index.js"

const teamA = alias(teams, "team_a")
const teamB = alias(teams, "team_b")

// Columns sent to the client (never logo_public_id)
const matchColumns = {
    id: matches.id,
    tournamentId: matches.tournamentId,
    scheduledAt: matches.scheduledAt,
    stage: matches.stage,
    notes: matches.notes,
    createdAt: matches.createdAt,
    teamA: { id: teamA.id, name: teamA.name, logo: teamA.logoUrl },
    teamB: { id: teamB.id, name: teamB.name, logo: teamB.logoUrl },
}

export const insertMatch = async (row: {
    tournamentId: number
    teamAId: number
    teamBId: number
    scheduledAt: Date
    stage: string | null
    notes: string | null
    createdBy: number
}) => {
    const [inserted] = await db.insert(matches).values(row).returning({ id: matches.id })
    return inserted
}

const selectMatches = () =>
    db
        .select(matchColumns)
        .from(matches)
        .innerJoin(teamA, eq(teamA.id, matches.teamAId))
        .innerJoin(teamB, eq(teamB.id, matches.teamBId))

export const findMatch = async (id: number) => {
    const [row] = await selectMatches().where(eq(matches.id, id)).limit(1)
    return row
}

// Matches of a tournament, earliest first
export const listTournamentMatches = (tournamentId: number) =>
    selectMatches().where(eq(matches.tournamentId, tournamentId)).orderBy(asc(matches.scheduledAt), asc(matches.id))
