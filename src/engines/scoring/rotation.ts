import { type Crease } from "./types.js"

type RunParts = {
    runsOffBat: number
    wides: number
    byes: number
    legByes: number
    overthrowRuns: number
    isBoundary: boolean
}

// Every run counted on the ball, not counting the penalty run of a wide or a no-ball
export const ballRunsOf = ({ runsOffBat, wides, byes, legByes }: Pick<RunParts, "runsOffBat" | "wides" | "byes" | "legByes">) =>
    runsOffBat + byes + legByes + Math.max(wides - 1, 0)

// The runs the batters physically ran, which is what decides the strike change:
// - a ball (or its overthrow) that reached the rope: those runs were not run
// - an overthrow boundary: only the runs completed before the throw were run
export const runsRunOf = (parts: RunParts) => {
    const ballRuns = ballRunsOf(parts)
    if (!parts.isBoundary) return ballRuns
    return parts.overthrowRuns > 0 ? ballRuns - parts.overthrowRuns : 0
}

type Change = {
    runsRun: number
    dismissedPlayerId: number | null
    overCompleted: boolean
}

// Who is at the crease after a ball:
// 1. an odd number of runs run changes the strike
// 2. a dismissed batter leaves an empty place (the scorer picks the next batter)
// 3. at the end of an over the batters change ends again, whatever the runs, and the bowler must be chosen again
export const nextCrease = (crease: Crease, { runsRun, dismissedPlayerId, overCompleted }: Change): Crease => {
    let { strikerId, nonStrikerId, bowlerId } = crease

    if (runsRun % 2 === 1) [strikerId, nonStrikerId] = [nonStrikerId, strikerId]

    if (dismissedPlayerId !== null) {
        if (strikerId === dismissedPlayerId) strikerId = null
        else if (nonStrikerId === dismissedPlayerId) nonStrikerId = null
    }

    if (overCompleted) {
        ;[strikerId, nonStrikerId] = [nonStrikerId, strikerId]
        bowlerId = null
    }

    return { strikerId, nonStrikerId, bowlerId }
}
