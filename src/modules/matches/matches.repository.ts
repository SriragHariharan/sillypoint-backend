import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../../db/postgres.js"
import { matches, teams } from "../../db/schema/index.js"
import { SCORER_PIN_MAX_ATTEMPTS } from "./matches.constants.js"

export type ScorerAccess = { linkToken: string; pin: string }

const teamA = alias(teams, "team_a")
const teamB = alias(teams, "team_b")

// Columns sent to the client (never logo_public_id)
const matchColumns = {
    id: matches.id,
    tournamentId: matches.tournamentId,
    scheduledAt: matches.scheduledAt,
    stage: matches.stage,
    notes: matches.notes,
    // Who won the toss and what they chose (bat or bowl); both null until the scorer records it
    tossWinnerTeamId: matches.tossWinnerTeamId,
    tossDecision: matches.tossDecision,
    // Overs each side bats; null until the scorer sets it
    oversPerSide: matches.oversPerSide,
    // Set once scoring starts; from then on the toss, overs and players are locked
    scoringStartedAt: matches.scoringStartedAt,
    // The result, set when the second innings is over
    completedAt: matches.completedAt,
    resultType: matches.resultType,
    winnerTeamId: matches.winnerTeamId,
    resultSummary: matches.resultSummary,
    // super_over / boundary_count when the regular innings did not decide the win
    decidedBy: matches.decidedBy,
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
    // The scorer's login, created with the match
    scorerLinkToken: string
    scorerPin: string
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

// Record (or change) the toss. Returns nothing if the match is gone.
export const setMatchToss = async (id: number, tossWinnerTeamId: number, tossDecision: string) => {
    const [row] = await db
        .update(matches)
        .set({ tossWinnerTeamId, tossDecision })
        .where(eq(matches.id, id))
        .returning({ id: matches.id })
    return row
}

// Record (or change) the overs per side. Returns nothing if the match is gone.
export const setMatchOvers = async (id: number, oversPerSide: number) => {
    const [row] = await db.update(matches).set({ oversPerSide }).where(eq(matches.id, id)).returning({ id: matches.id })
    return row
}

// The scorer's login link and PIN (for the organizer only; never part of the public match columns)
export const findScorerAccess = async (id: number) => {
    const [row] = await db
        .select({ linkToken: matches.scorerLinkToken, pin: matches.scorerPin })
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1)
    return row
}

// Give a scorer who has no link/PIN yet one (a scorer added before links existed). Returns nothing if one is already set.
export const setScorerAccess = async (id: number, access: ScorerAccess) => {
    const [row] = await db
        .update(matches)
        .set({ scorerLinkToken: access.linkToken, scorerPin: access.pin })
        .where(and(eq(matches.id, id), isNull(matches.scorerLinkToken)))
        .returning({ id: matches.id })
    return row
}

// The match a login link belongs to, with what is needed to check the PIN
export const findScorerLogin = async (linkToken: string) => {
    const [row] = await db
        .select({
            id: matches.id,
            tournamentId: matches.tournamentId,
            pin: matches.scorerPin,
            lockedUntil: matches.scorerLockedUntil,
        })
        .from(matches)
        .where(eq(matches.scorerLinkToken, linkToken))
        .limit(1)
    return row
}

// Count a wrong try; at the limit lock the login until lockedUntil and start counting again (one atomic update)
export const recordScorerLoginFailure = async (id: number, lockedUntil: Date) => {
    const reachedLimit = sql`${matches.scorerPinAttempts} + 1 >= ${SCORER_PIN_MAX_ATTEMPTS}`
    await db
        .update(matches)
        .set({
            scorerPinAttempts: sql`case when ${reachedLimit} then 0 else ${matches.scorerPinAttempts} + 1 end`,
            scorerLockedUntil: sql`case when ${reachedLimit} then ${lockedUntil.toISOString()}::timestamptz else ${matches.scorerLockedUntil} end`,
        })
        .where(eq(matches.id, id))
}

export const clearScorerLoginFailures = async (id: number) => {
    await db.update(matches).set({ scorerPinAttempts: 0, scorerLockedUntil: null }).where(eq(matches.id, id))
}

// Matches of a tournament, earliest first
export const listTournamentMatches = (tournamentId: number) =>
    selectMatches().where(eq(matches.tournamentId, tournamentId)).orderBy(desc(matches.scheduledAt), desc(matches.id))
