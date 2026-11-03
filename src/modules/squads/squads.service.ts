import { assertScoringOpen } from "../matches/matches.service.js"
import { type PlayerRow, findMatchPlayers, replaceMatchPlayers } from "./squads.repository.js"
import { type SaveSquadsInput } from "./squads.schema.js"

type Team = { id: number; name: string; logo: string | null }
type Squad = Awaited<ReturnType<typeof findMatchPlayers>>

// One team's players split into playing and substitutes, in position order
const teamSquad = (team: Team, rows: Squad) => {
    const mine = rows.filter((row) => row.teamId === team.id)
    const pick = (squad: string) =>
        mine.filter((row) => row.squad === squad).map(({ name }) => ({ name }))
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

// Save both teams' players (replaces what was there); the array order is the position
export const saveSquads = async (matchId: number, input: SaveSquadsInput) => {
    const match = await assertScoringOpen(matchId)

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
