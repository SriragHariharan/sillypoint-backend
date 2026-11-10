import { ballRunsOf } from "./rotation.js"
import { type DeliveryRow, type WicketType } from "./types.js"

// A short label for one ball in the over timeline:
// "0", "1", "4", "W", "1+W", "Wd", "Wd+2", "Nb+4", "Nb+B2", "B1", "Lb2", "1+OT4", "Ret"
export const ballLabel = (row: DeliveryRow) => {
    if (row.kind === "retirement") return "Ret"

    const completed = ballRunsOf(row) - row.overthrowRuns
    const tokens: string[] = []

    if (row.wides > 0) tokens.push("Wd")
    if (row.noBalls > 0) tokens.push("Nb")

    if (completed > 0) {
        if (row.byes > 0) tokens.push(`B${completed}`)
        else if (row.legByes > 0) tokens.push(`Lb${completed}`)
        else tokens.push(String(completed))
    }

    if (row.overthrowRuns > 0) tokens.push(`OT${row.overthrowRuns}`)
    if (row.wicketType !== null) tokens.push("W")

    return tokens.join("+") || "0"
}

// "c Kumar b Rao", "lbw b Rao", "run out (Singh)", "st †Dev b Rao", "retired hurt"
export const dismissalText = (wicketType: WicketType, bowler: string, fielder: string | null) => {
    switch (wicketType) {
        case "bowled":
            return `b ${bowler}`
        case "caught":
            return fielder === null || fielder === bowler ? `c & b ${bowler}` : `c ${fielder} b ${bowler}`
        case "lbw":
            return `lbw b ${bowler}`
        case "stumped":
            return `st †${fielder ?? "?"} b ${bowler}`
        case "run_out":
            return fielder ? `run out (${fielder})` : "run out"
        case "hit_wicket":
            return `hit wicket b ${bowler}`
        case "obstructing_field":
            return "obstructing the field"
        case "retired_hurt":
            return "retired hurt"
        case "retired_out":
            return "retired out"
    }
}
