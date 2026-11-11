import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { innings, matches, teams } from "../../db/schema/index.js"
import { REGULAR_INNINGS } from "../../shared/constants/scoring.js"
import { LEAGUE_STAGES } from "../../shared/constants/standings.js"

// Completed league matches of a tournament (no stage label, or a league stage); knockout matches do not count
export const findCompletedLeagueMatches = async (tournamentId: number) => {
    const rows = await db
        .select({
            id: matches.id,
            teamAId: matches.teamAId,
            teamBId: matches.teamBId,
            resultType: matches.resultType,
            winnerTeamId: matches.winnerTeamId,
            oversPerSide: matches.oversPerSide,
            completedAt: matches.completedAt,
        })
        .from(matches)
        .where(
            and(
                eq(matches.tournamentId, tournamentId),
                isNotNull(matches.completedAt),
                or(isNull(matches.stage), inArray(matches.stage, [...LEAGUE_STAGES])),
            ),
        )
        .orderBy(asc(matches.completedAt), asc(matches.id))

    return rows.flatMap((row) =>
        row.completedAt && row.resultType ? [{ ...row, completedAt: row.completedAt, resultType: row.resultType }] : [],
    )
}

// The regular innings of these matches (the Super Over does not count towards the net run rate)
export const findRegularInnings = (matchIds: number[]) =>
    matchIds.length === 0
        ? Promise.resolve([])
        : db
              .select({
                  matchId: innings.matchId,
                  battingTeamId: innings.battingTeamId,
                  runs: innings.runs,
                  legalBalls: innings.legalBalls,
                  endReason: innings.endReason,
              })
              .from(innings)
              .where(and(inArray(innings.matchId, matchIds), lte(innings.inningsNumber, REGULAR_INNINGS)))
              .orderBy(asc(innings.matchId), asc(innings.inningsNumber))

// Public columns of some teams (for teams that played league matches but were removed from the tournament since)
export const findTeams = (teamIds: number[]) =>
    teamIds.length === 0
        ? Promise.resolve([])
        : db.select({ id: teams.id, name: teams.name, logo: teams.logoUrl }).from(teams).where(inArray(teams.id, teamIds))
