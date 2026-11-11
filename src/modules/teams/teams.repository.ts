import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../../db/postgres.js"
import { innings, matches, teams, tournaments } from "../../db/schema/index.js"
import { type Tx } from "../users/users.repository.js"
import { type TeamMatchesQuery } from "./teams.schema.js"

// Columns sent to the client (never logo_public_id)
const teamColumns = {
    id: teams.id,
    name: teams.name,
    logo: teams.logoUrl,
    manager_name: teams.managerName,
    manager_mobile: teams.managerMobile,
    manager_id: teams.managerId,
    created_at: teams.createdAt,
    updated_at: teams.updatedAt,
}

// Save a new team
export const insertTeam = async (values: {
    name: string
    logoUrl: string | null
    logoPublicId: string | null
    managerName: string
    managerMobile: string
    managerId: number
}) => {
    const [row] = await db.insert(teams).values(values).returning(teamColumns)
    return row
}

// One team, only if this user manages it
export const findTeamByManager = async (id: number, managerId: number) => {
    const [row] = await db
        .select(teamColumns)
        .from(teams)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .limit(1)
    return row
}

// All teams managed by this user, newest first
export const listTeamsByManager = (managerId: number) =>
    db.select(teamColumns).from(teams).where(eq(teams.managerId, managerId)).orderBy(desc(teams.createdAt), desc(teams.id))

// Which of these teams this user manages
export const findManagedTeamIds = async (managerId: number, ids: number[]) => {
    const rows = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.managerId, managerId), inArray(teams.id, ids)))
    return rows.map((row) => row.id)
}

// Lock the team row (only if this user manages it) and get its current logo
export const findTeamForUpdate = async (tx: Tx, id: number, managerId: number) => {
    const [row] = await tx
        .select({ id: teams.id, logoPublicId: teams.logoPublicId })
        .from(teams)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .limit(1)
        .for("update")
    return row
}

// Update the allowed fields. manager_id is never part of the values.
export const updateTeam = async (
    tx: Tx,
    id: number,
    managerId: number,
    values: {
        name?: string
        managerName?: string
        managerMobile?: string
        logoUrl?: string
        logoPublicId?: string
    },
) => {
    const [row] = await tx
        .update(teams)
        .set(values)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .returning(teamColumns)
    return row
}

const teamA = alias(teams, "team_a")
const teamB = alias(teams, "team_b")
const inningsA = alias(innings, "innings_a")
const inningsB = alias(innings, "innings_b")

const playedBy = (teamId: number) => or(eq(matches.teamAId, teamId), eq(matches.teamBId, teamId))

// The match states, in the order they are decided: finished, then being scored, then not started
const stateCondition = (status: NonNullable<TeamMatchesQuery["status"]>) => {
    switch (status) {
        case "completed":
            return isNotNull(matches.completedAt)
        case "live":
            return and(isNull(matches.completedAt), isNotNull(matches.scoringStartedAt))
        case "upcoming":
            return and(isNull(matches.completedAt), isNull(matches.scoringStartedAt))
    }
}

// A page of the matches this team plays in (newest first) with each side's score, and how many match in total
export const listTeamMatches = async (teamId: number, query: TeamMatchesQuery) => {
    const where = and(playedBy(teamId), query.status ? stateCondition(query.status) : undefined)

    const [rows, totals] = await Promise.all([
        db
            .select({
                id: matches.id,
                scheduledAt: matches.scheduledAt,
                stage: matches.stage,
                completedAt: matches.completedAt,
                scoringStartedAt: matches.scoringStartedAt,
                resultType: matches.resultType,
                winnerTeamId: matches.winnerTeamId,
                resultSummary: matches.resultSummary,
                tournament: { id: tournaments.id, name: tournaments.name },
                teamA: { id: teamA.id, name: teamA.name, logo: teamA.logoUrl },
                teamB: { id: teamB.id, name: teamB.name, logo: teamB.logoUrl },
                runsA: inningsA.runs,
                wicketsA: inningsA.wickets,
                ballsA: inningsA.legalBalls,
                runsB: inningsB.runs,
                wicketsB: inningsB.wickets,
                ballsB: inningsB.legalBalls,
            })
            .from(matches)
            .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
            .innerJoin(teamA, eq(teamA.id, matches.teamAId))
            .innerJoin(teamB, eq(teamB.id, matches.teamBId))
            .leftJoin(inningsA, and(eq(inningsA.matchId, matches.id), eq(inningsA.battingTeamId, matches.teamAId)))
            .leftJoin(inningsB, and(eq(inningsB.matchId, matches.id), eq(inningsB.battingTeamId, matches.teamBId)))
            .where(where)
            .orderBy(desc(matches.scheduledAt), desc(matches.id))
            .limit(query.limit)
            .offset((query.page - 1) * query.limit),
        db
            .select({ total: count() })
            .from(matches)
            .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
            .where(where),
    ])

    return { rows, total: totals[0]?.total ?? 0 }
}

// How the team's matches add up (all of them, whatever page or filter is shown)
export const summariseTeamMatches = async (teamId: number) => {
    const [row] = await db
        .select({
            played: sql<number>`count(*) filter (where ${matches.completedAt} is not null)::int`,
            won: sql<number>`count(*) filter (where ${matches.resultType} = 'win' and ${matches.winnerTeamId} = ${teamId})::int`,
            lost: sql<number>`count(*) filter (where ${matches.resultType} = 'win' and ${matches.winnerTeamId} <> ${teamId})::int`,
            tied: sql<number>`count(*) filter (where ${matches.resultType} = 'tie')::int`,
            upcoming: sql<number>`count(*) filter (where ${matches.completedAt} is null and ${matches.scoringStartedAt} is null)::int`,
        })
        .from(matches)
        .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
        .where(playedBy(teamId))

    return row ?? { played: 0, won: 0, lost: 0, tied: 0, upcoming: 0 }
}
