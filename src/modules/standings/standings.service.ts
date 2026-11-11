import { buildPointsTable, type StandingsMatch, type StandingsTeam } from "../../engines/standings/points-table.js"
import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import {
    POINTS_FOR_LOSS,
    POINTS_FOR_NO_RESULT,
    POINTS_FOR_TIE,
    POINTS_FOR_WIN,
} from "../../shared/constants/standings.js"
import { listTeamsInTournament } from "../tournaments/tournaments.service.js"
import { findCompletedLeagueMatches, findRegularInnings, findTeams } from "./standings.repository.js"

// The tournament's points table: every enrolled team (and any removed team that played a counted match),
// from the completed league matches. 404 if the tournament does not exist.
export const getStandings = async (tournamentId: number) => {
    const enrolled = await listTeamsInTournament(tournamentId)
    const matchRows = await findCompletedLeagueMatches(tournamentId)
    const inningsRows = await findRegularInnings(matchRows.map((match) => match.id))

    const known = new Set(enrolled.map((team) => team.id))
    const removedIds = [...new Set(matchRows.flatMap((match) => [match.teamAId, match.teamBId]))].filter((id) => !known.has(id))
    const teams: StandingsTeam[] = [
        ...enrolled.map(({ id, name, logo }) => ({ id, name, logo })),
        ...(await findTeams(removedIds)),
    ]

    const matches: StandingsMatch[] = matchRows.map((match) => ({
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        resultType: match.resultType,
        winnerTeamId: match.winnerTeamId,
        completedAt: match.completedAt,
        ballsPerSide: (match.oversPerSide ?? 0) * BALLS_PER_OVER,
        innings: inningsRows
            .filter((row) => row.matchId === match.id)
            .map((row) => ({
                battingTeamId: row.battingTeamId,
                runs: row.runs,
                legalBalls: row.legalBalls,
                allOut: row.endReason === "all_out",
            })),
    }))

    return {
        pointsSystem: { win: POINTS_FOR_WIN, tie: POINTS_FOR_TIE, noResult: POINTS_FOR_NO_RESULT, loss: POINTS_FOR_LOSS },
        countedMatches: matches.length,
        rows: buildPointsTable({ teams, matches }),
    }
}
