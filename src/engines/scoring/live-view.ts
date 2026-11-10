import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import { oversText, round } from "./delivery-math.js"
import {
    type BatterOption,
    ballsBowledInOver,
    batterOptions,
    type BowlerOption,
    bowlerOptions,
    currentOverOf,
    isFreeHitNext,
} from "./innings-state.js"
import { ballLabel } from "./labels.js"
import { type BattingLine, type BowlingLine, buildInningsCard } from "./scorecard.js"
import { type DeliveryRow, type InningsSnapshot, type MatchRules, type PlayerInfo } from "./types.js"

export type LiveBatter = Pick<BattingLine, "playerId" | "name" | "runs" | "balls" | "fours" | "sixes">
export type LiveBowler = Pick<BowlingLine, "playerId" | "name" | "overs" | "maidens" | "runs" | "wickets">

export type LiveView = {
    overs: string
    runRate: number
    striker: LiveBatter | null
    nonStriker: LiveBatter | null
    bowler: LiveBowler | null
    // Balls of the over being bowled (or the one just finished, until the next bowler is chosen)
    thisOver: string[]
    // What the scorer must choose before the next ball: a batter after a wicket, a bowler after an over
    pending: "batter" | "bowler" | null
    isFreeHit: boolean
    canUndo: boolean
    // The bowler can still be changed because no ball of the over has been bowled
    canChangeBowler: boolean
    availableBatters: BatterOption[]
    availableBowlers: BowlerOption[]
    // Chasing side only
    requiredRuns: number | null
    requiredRate: number | null
    ballsRemaining: number
}

type LiveViewInput = {
    snapshot: InningsSnapshot
    rows: readonly DeliveryRow[]
    battingPlayers: readonly PlayerInfo[]
    bowlingPlayers: readonly PlayerInfo[]
    names: ReadonlyMap<number, string>
    rules: MatchRules
}

// Everything the scoring screen shows for the innings in progress, worked out from its deliveries
export const buildLiveView = ({ snapshot, rows, battingPlayers, bowlingPlayers, names, rules }: LiveViewInput): LiveView => {
    const card = buildInningsCard(rows, {
        battingPlayers,
        names,
        strikerId: snapshot.strikerId,
        nonStrikerId: snapshot.nonStrikerId,
    })

    const batter = (id: number | null): LiveBatter | null => {
        if (id === null) return null
        const line = card.batting.find((entry) => entry.playerId === id)
        return line
            ? { playerId: line.playerId, name: line.name, runs: line.runs, balls: line.balls, fours: line.fours, sixes: line.sixes }
            : null
    }

    const bowler = (id: number | null): LiveBowler | null => {
        if (id === null) return null
        const line = card.bowling.find((entry) => entry.playerId === id)
        if (line) {
            return { playerId: line.playerId, name: line.name, overs: line.overs, maidens: line.maidens, runs: line.runs, wickets: line.wickets }
        }
        return { playerId: id, name: names.get(id) ?? "Unknown", overs: "0.0", maidens: 0, runs: 0, wickets: 0 }
    }

    const inProgress = snapshot.status === "in_progress"
    const pending: LiveView["pending"] = !inProgress
        ? null
        : snapshot.strikerId === null || snapshot.nonStrikerId === null
          ? "batter"
          : snapshot.bowlerId === null
            ? "bowler"
            : null

    const over = currentOverOf(snapshot.legalBalls)
    const justFinishedOver = snapshot.bowlerId === null && snapshot.legalBalls > 0 && snapshot.legalBalls % BALLS_PER_OVER === 0
    const shownOver = justFinishedOver ? over - 1 : over

    const canChangeBowler = inProgress && pending === null && ballsBowledInOver(rows, over) === 0
    const ballsRemaining = Math.max(rules.oversPerSide * BALLS_PER_OVER - snapshot.legalBalls, 0)
    const requiredRuns = snapshot.target === null ? null : Math.max(snapshot.target - snapshot.runs, 0)

    return {
        overs: oversText(snapshot.legalBalls, BALLS_PER_OVER),
        runRate: card.total.runRate,
        striker: batter(snapshot.strikerId),
        nonStriker: batter(snapshot.nonStrikerId),
        bowler: bowler(snapshot.bowlerId),
        thisOver: rows.filter((row) => row.overNumber === shownOver).map(ballLabel),
        pending,
        isFreeHit: inProgress && isFreeHitNext(rows),
        canUndo: rows.length > 0,
        canChangeBowler,
        availableBatters: pending === "batter" ? batterOptions(rows, battingPlayers, snapshot) : [],
        availableBowlers:
            pending === "bowler" || canChangeBowler ? bowlerOptions(rows, bowlingPlayers, snapshot.legalBalls, rules) : [],
        requiredRuns,
        requiredRate:
            requiredRuns !== null && ballsRemaining > 0 ? round(requiredRuns / (ballsRemaining / BALLS_PER_OVER), 2) : null,
        ballsRemaining,
    }
}
