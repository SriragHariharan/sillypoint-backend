import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import {
    FORM_LENGTH,
    NRR_DECIMALS,
    POINTS_FOR_LOSS,
    POINTS_FOR_NO_RESULT,
    POINTS_FOR_TIE,
    POINTS_FOR_WIN,
} from "../../shared/constants/standings.js"
import { round } from "../scoring/delivery-math.js"

export type StandingsTeam = { id: number; name: string; logo: string | null }

export type StandingsInnings = {
    battingTeamId: number
    runs: number
    legalBalls: number
    // An all-out side is counted as having faced its full quota of overs
    allOut: boolean
}

export type StandingsMatch = {
    teamAId: number
    teamBId: number
    resultType: string
    winnerTeamId: number | null
    completedAt: Date
    // Legal balls each side could face (overs per side x 6)
    ballsPerSide: number
    // The regular innings only (never the Super Over)
    innings: StandingsInnings[]
}

export type FormResult = "W" | "L" | "T" | "NR"

export type StandingsRow = {
    position: number
    team: StandingsTeam
    played: number
    won: number
    lost: number
    tied: number
    noResult: number
    points: number
    // Null until the team has batted and bowled in a counted match
    netRunRate: number | null
    runsFor: number
    ballsFaced: number
    runsAgainst: number
    ballsBowled: number
    // Latest first
    form: FormResult[]
}

type Tally = Omit<StandingsRow, "position" | "netRunRate" | "form"> & { results: { at: number; result: FormResult }[] }

const emptyTally = (team: StandingsTeam): Tally => ({
    team,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    results: [],
})

const resultFor = (match: StandingsMatch, teamId: number): FormResult => {
    if (match.resultType === "win") return match.winnerTeamId === teamId ? "W" : "L"
    if (match.resultType === "tie") return "T"
    return "NR"
}

const POINTS: Record<FormResult, number> = {
    W: POINTS_FOR_WIN,
    L: POINTS_FOR_LOSS,
    T: POINTS_FOR_TIE,
    NR: POINTS_FOR_NO_RESULT,
}

// Runs per over scored minus runs per over conceded
const netRunRateOf = (tally: Tally) => {
    if (tally.ballsFaced === 0 || tally.ballsBowled === 0) return null
    const scored = tally.runsFor / (tally.ballsFaced / BALLS_PER_OVER)
    const conceded = tally.runsAgainst / (tally.ballsBowled / BALLS_PER_OVER)
    return round(scored - conceded, NRR_DECIMALS)
}

// Points, then net run rate (a team without one last), then wins, then name
const compareRows = (a: StandingsRow, b: StandingsRow) =>
    b.points - a.points ||
    (b.netRunRate ?? Number.NEGATIVE_INFINITY) - (a.netRunRate ?? Number.NEGATIVE_INFINITY) ||
    b.won - a.won ||
    a.team.name.localeCompare(b.team.name)

// The points table from the completed league matches. Every team listed gets a row, even before it has played.
export const buildPointsTable = (input: { teams: readonly StandingsTeam[]; matches: readonly StandingsMatch[] }) => {
    const tallies = new Map(input.teams.map((team) => [team.id, emptyTally(team)]))

    for (const match of input.matches) {
        for (const teamId of [match.teamAId, match.teamBId]) {
            const tally = tallies.get(teamId)
            if (!tally) continue
            const result = resultFor(match, teamId)
            tally.played += 1
            if (result === "W") tally.won += 1
            else if (result === "L") tally.lost += 1
            else if (result === "T") tally.tied += 1
            else tally.noResult += 1
            tally.points += POINTS[result]
            tally.results.push({ at: match.completedAt.getTime(), result })
        }

        // Net run rate needs both innings; an abandoned match without them only adds its result
        if (match.innings.length < 2) continue
        for (const innings of match.innings) {
            const balls = innings.allOut ? match.ballsPerSide : innings.legalBalls
            const bowlingTeamId = innings.battingTeamId === match.teamAId ? match.teamBId : match.teamAId
            const batting = tallies.get(innings.battingTeamId)
            const bowling = tallies.get(bowlingTeamId)
            if (batting) {
                batting.runsFor += innings.runs
                batting.ballsFaced += balls
            }
            if (bowling) {
                bowling.runsAgainst += innings.runs
                bowling.ballsBowled += balls
            }
        }
    }

    const rows: StandingsRow[] = [...tallies.values()].map(({ results, ...tally }) => ({
        ...tally,
        position: 0,
        netRunRate: netRunRateOf({ ...tally, results }),
        form: [...results]
            .sort((a, b) => b.at - a.at)
            .slice(0, FORM_LENGTH)
            .map((entry) => entry.result),
    }))

    return rows.sort(compareRows).map((row, index) => ({ ...row, position: index + 1 }))
}
