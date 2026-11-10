type Side = { teamId: number; name: string; runs: number }

export type MatchResult = {
    resultType: "win" | "tie"
    winnerTeamId: number | null
    summary: string
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// Who won once both innings are over. The side batting second wins by the wickets it had left,
// the side batting first by the runs it was ahead; level scores are a tie.
export const computeResult = (input: {
    first: Side
    second: Side & { wickets: number }
    playersPerSide: number
}): MatchResult => {
    const { first, second, playersPerSide } = input

    if (second.runs > first.runs) {
        const wicketsLeft = Math.max(playersPerSide - 1 - second.wickets, 0)
        return {
            resultType: "win",
            winnerTeamId: second.teamId,
            summary: `${second.name} won by ${plural(wicketsLeft, "wicket")}`,
        }
    }

    if (second.runs === first.runs) return { resultType: "tie", winnerTeamId: null, summary: "Match tied" }

    return {
        resultType: "win",
        winnerTeamId: first.teamId,
        summary: `${first.name} won by ${plural(first.runs - second.runs, "run")}`,
    }
}
