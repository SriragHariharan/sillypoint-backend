import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import { batBoundaryOf, bowlerRunsOf, isBowlerWicket, isTeamWicket, oversText, round, totalRunsOf } from "./delivery-math.js"
import { ballLabel, dismissalText } from "./labels.js"
import { type DeliveryRow, type PlayerInfo } from "./types.js"

export type BattingStatus = "not_out" | "out" | "retired_hurt" | "retired_out"

export type BattingLine = {
    playerId: number
    name: string
    runs: number
    balls: number
    fours: number
    sixes: number
    strikeRate: number
    status: BattingStatus
    howOut: string | null
}

export type BowlingLine = {
    playerId: number
    name: string
    overs: string
    legalBalls: number
    maidens: number
    runs: number
    wickets: number
    wides: number
    noBalls: number
    dots: number
    economy: number
}

export type FallOfWicket = { wicketNumber: number; runs: number; playerId: number; name: string; over: string }

export type OverSummary = {
    // 1-based, as shown to people
    over: number
    bowlerId: number
    bowler: string
    runs: number
    wickets: number
    balls: string[]
}

export type InningsCard = {
    total: { runs: number; wickets: number; legalBalls: number; overs: string; runRate: number }
    batting: BattingLine[]
    didNotBat: PlayerInfo[]
    extras: { byes: number; legByes: number; wides: number; noBalls: number; total: number }
    bowling: BowlingLine[]
    fallOfWickets: FallOfWicket[]
    overs: OverSummary[]
}

type CardInput = {
    // The batting team's playing XI in batting order (positions), used for "did not bat"
    battingPlayers: readonly PlayerInfo[]
    // Names of every player of the match (both squads, substitutes too) so any batter, bowler or fielder can be named
    names: ReadonlyMap<number, string>
    // Who is at the crease now, so a batter who came in but has not faced a ball yet is still listed
    strikerId: number | null
    nonStrikerId: number | null
}

const nameOf = (names: ReadonlyMap<number, string>, id: number | null) => (id === null ? null : (names.get(id) ?? "Unknown"))

// Builds the whole scorecard of one innings from its deliveries (voided ones already left out), in one pass
export const buildInningsCard = (rows: readonly DeliveryRow[], input: CardInput): InningsCard => {
    const { names } = input

    // Batters in the order they came to the crease
    const batters = new Map<number, BattingLine>()
    const enter = (id: number | null) => {
        if (id === null || batters.has(id)) return
        batters.set(id, {
            playerId: id,
            name: nameOf(names, id) ?? "Unknown",
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            strikeRate: 0,
            status: "not_out",
            howOut: null,
        })
    }

    const bowlers = new Map<number, BowlingLine>()
    const extras = { byes: 0, legByes: 0, wides: 0, noBalls: 0, total: 0 }
    const fallOfWickets: FallOfWicket[] = []
    let runs = 0
    let wickets = 0
    let legalBalls = 0

    for (const row of rows) {
        enter(row.strikerId)
        enter(row.nonStrikerId)

        // A batter who retired hurt and is at the crease again is not retired any more
        for (const id of [row.strikerId, row.nonStrikerId]) {
            const returning = batters.get(id)
            if (returning && returning.status === "retired_hurt") {
                returning.status = "not_out"
                returning.howOut = null
            }
        }

        if (row.kind === "ball") {
            const striker = batters.get(row.strikerId)
            if (striker) {
                striker.runs += row.runsOffBat
                if (row.wides === 0) striker.balls += 1
                const boundary = batBoundaryOf(row)
                if (boundary === "four") striker.fours += 1
                if (boundary === "six") striker.sixes += 1
            }

            let bowler = bowlers.get(row.bowlerId)
            if (!bowler) {
                bowler = {
                    playerId: row.bowlerId,
                    name: nameOf(names, row.bowlerId) ?? "Unknown",
                    overs: "0.0",
                    legalBalls: 0,
                    maidens: 0,
                    runs: 0,
                    wickets: 0,
                    wides: 0,
                    noBalls: 0,
                    dots: 0,
                    economy: 0,
                }
                bowlers.set(row.bowlerId, bowler)
            }
            const conceded = bowlerRunsOf(row)
            bowler.runs += conceded
            if (row.isLegal) bowler.legalBalls += 1
            if (row.isLegal && conceded === 0) bowler.dots += 1
            if (row.wides > 0) bowler.wides += 1
            if (row.noBalls > 0) bowler.noBalls += 1
            if (isBowlerWicket(row.wicketType)) bowler.wickets += 1

            extras.byes += row.byes
            extras.legByes += row.legByes
            extras.wides += row.wides
            extras.noBalls += row.noBalls
        }

        runs += totalRunsOf(row)
        if (row.isLegal) legalBalls += 1

        if (row.wicketType !== null && row.dismissedPlayerId !== null) {
            const out = batters.get(row.dismissedPlayerId)
            if (out) {
                out.status =
                    row.wicketType === "retired_hurt" ? "retired_hurt" : row.wicketType === "retired_out" ? "retired_out" : "out"
                out.howOut = dismissalText(
                    row.wicketType,
                    nameOf(names, row.bowlerId) ?? "Unknown",
                    nameOf(names, row.fielderId),
                )
            }

            if (isTeamWicket(row.wicketType)) {
                wickets += 1
                fallOfWickets.push({
                    wicketNumber: wickets,
                    runs,
                    playerId: row.dismissedPlayerId,
                    name: nameOf(names, row.dismissedPlayerId) ?? "Unknown",
                    over: `${row.overNumber}.${row.ballsInOver}`,
                })
            }
        }
    }

    // Anyone at the crease who has not faced a ball yet
    enter(input.strikerId)
    enter(input.nonStrikerId)

    const batting = [...batters.values()].map((line) => ({
        ...line,
        strikeRate: line.balls > 0 ? round((line.runs / line.balls) * 100, 1) : 0,
    }))

    // Overs: group the deliveries by over (they are in order)
    const overs: OverSummary[] = []
    const maidens = new Map<number, number>()
    let group: { overNumber: number; rows: DeliveryRow[] } | null = null
    const groups: { overNumber: number; rows: DeliveryRow[] }[] = []
    for (const row of rows) {
        if (!group || group.overNumber !== row.overNumber) {
            group = { overNumber: row.overNumber, rows: [] }
            groups.push(group)
        }
        group.rows.push(row)
    }

    for (const { overNumber, rows: overRows } of groups) {
        const balls = overRows.filter((row) => row.kind === "ball")
        const first = balls[0]
        if (!first) continue

        overs.push({
            over: overNumber + 1,
            bowlerId: first.bowlerId,
            bowler: nameOf(names, first.bowlerId) ?? "Unknown",
            runs: overRows.reduce((sum, row) => sum + totalRunsOf(row), 0),
            wickets: overRows.filter((row) => isTeamWicket(row.wicketType)).length,
            balls: overRows.map(ballLabel),
        })

        const legalInOver = balls.filter((row) => row.isLegal).length
        const conceded = balls.reduce((sum, row) => sum + bowlerRunsOf(row), 0)
        if (legalInOver === BALLS_PER_OVER && conceded === 0) {
            maidens.set(first.bowlerId, (maidens.get(first.bowlerId) ?? 0) + 1)
        }
    }

    const bowling = [...bowlers.values()].map((line) => ({
        ...line,
        overs: oversText(line.legalBalls, BALLS_PER_OVER),
        maidens: maidens.get(line.playerId) ?? 0,
        economy: line.legalBalls > 0 ? round(line.runs / (line.legalBalls / BALLS_PER_OVER), 2) : 0,
    }))

    extras.total = extras.byes + extras.legByes + extras.wides + extras.noBalls

    return {
        total: {
            runs,
            wickets,
            legalBalls,
            overs: oversText(legalBalls, BALLS_PER_OVER),
            runRate: legalBalls > 0 ? round(runs / (legalBalls / BALLS_PER_OVER), 2) : 0,
        },
        batting,
        didNotBat: input.battingPlayers.filter((player) => !batters.has(player.id)),
        extras,
        bowling,
        fallOfWickets,
        overs,
    }
}
