import { SCORING_STARTED_LOCKED } from "../../shared/constants/scoring.js"
import { BadRequestError, ConflictError } from "../../shared/http/errors.js"
import { assertScoringOpen } from "../matches/matches.service.js"
import { TOO_MANY_PLAYERS } from "./squads.constants.js"
import { type PlayerRow, findMatchPlayers, replaceMatchPlayers } from "./squads.repository.js"
import { type SaveSquadsInput } from "./squads.schema.js"

type Team = { id: number; name: string; logo: string | null }
type Squad = Awaited<ReturnType<typeof findMatchPlayers>>

// One team's players split into playing and substitutes, in position order
const teamSquad = (team: Team, rows: Squad) => {
    const mine = rows.filter((row) => row.teamId === team.id)
    const pick = (squad: string) =>
        mine.filter((row) => row.squad === squad).map(({ id, name }) => ({ id, name }))
    return { team, playing: pick("playing"), substitutes: pick("substitute") }
}

const squadsOf = (teamA: Team, teamB: Team, rows: Squad) => ({
    teamA: teamSquad(teamA, rows),
    teamB: teamSquad(teamB, rows),
})

// Both teams' players for the scorer's match
export const getSquads = async (matchId: number) => {
    const match = await assertScoringOpen(matchId)
    return squadsOf(match.teamA, match.teamB, await findMatchPlayers(matchId))
}

// Every player of a match with their id, team and squad (for scoring and scorecards)
export const getMatchPlayers = (matchId: number) => findMatchPlayers(matchId)

// Save both teams' players (replaces what was there); the array order is the position
export const saveSquads = async (matchId: number, input: SaveSquadsInput) => {
    const match = await assertScoringOpen(matchId)

    // Balls recorded for a match point at these players, so they cannot be replaced once scoring has started
    if (match.scoringStartedAt) throw new ConflictError(SCORING_STARTED_LOCKED)

    // The tournament decides how many players and substitutes a team may name
    const { playersPerSide, substitutesPerSide } = match.tournament
    for (const side of [input.teamA, input.teamB]) {
        if (side.playing.length > playersPerSide) {
            throw new BadRequestError(`${TOO_MANY_PLAYERS} ${playersPerSide} players per team`)
        }
        if (side.substitutes.length > substitutesPerSide) {
            throw new BadRequestError(`${TOO_MANY_PLAYERS} ${substitutesPerSide} substitutes per team`)
        }
    }

    const rowsFor = (teamId: number, side: SaveSquadsInput["teamA"]): PlayerRow[] => [
        ...side.playing.map((player, index) => ({
            matchId,
            teamId,
            squad: "playing",
            position: index + 1,
            ...player,
        })),
        ...side.substitutes.map((player, index) => ({
            matchId,
            teamId,
            squad: "substitute",
            position: index + 1,
            ...player,
        })),
    ]

    await replaceMatchPlayers(matchId, [...rowsFor(match.teamA.id, input.teamA), ...rowsFor(match.teamB.id, input.teamB)])
    return squadsOf(match.teamA, match.teamB, await findMatchPlayers(matchId))
}
