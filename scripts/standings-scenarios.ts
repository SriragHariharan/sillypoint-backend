// Checks the points table engine against worked scenarios. Run with: npm run check:standings
import assert from "node:assert/strict"
import {
    buildPointsTable,
    type StandingsInnings,
    type StandingsMatch,
    type StandingsTeam,
} from "../src/engines/standings/points-table.js"

const team = (id: number, name: string): StandingsTeam => ({ id, name, logo: null })
const REDS = team(1, "Reds")
const BLUES = team(2, "Blues")
const GREENS = team(3, "Greens")
const GOLDS = team(4, "Golds")

let day = 0
const inn = (battingTeamId: number, runs: number, legalBalls: number, allOut = false): StandingsInnings => ({
    battingTeamId,
    runs,
    legalBalls,
    allOut,
})

// A 20-over match; `innings` are the two regular innings in batting order
const match = (
    teamAId: number,
    teamBId: number,
    result: { winner: number } | "tie" | "no_result",
    innings: StandingsInnings[],
): StandingsMatch => {
    day += 1
    return {
        teamAId,
        teamBId,
        resultType: result === "tie" ? "tie" : result === "no_result" ? "no_result" : "win",
        winnerTeamId: typeof result === "object" ? result.winner : null,
        completedAt: new Date(Date.UTC(2026, 0, day)),
        ballsPerSide: 120,
        innings,
    }
}

const rowOf = (rows: ReturnType<typeof buildPointsTable>, id: number) => {
    const row = rows.find((entry) => entry.team.id === id)
    if (!row) throw new Error(`no row for team ${id}`)
    return row
}

let passed = 0
const check = (name: string, run: () => void) => {
    try {
        run()
        passed += 1
    } catch (error) {
        console.error(`FAIL  ${name}`)
        throw error
    }
}

check("points: win 2, tie 1, no result 1, loss 0; every team gets a row", () => {
    const rows = buildPointsTable({
        teams: [REDS, BLUES, GREENS, GOLDS],
        matches: [
            match(1, 2, { winner: 1 }, [inn(1, 150, 120), inn(2, 140, 120)]),
            match(1, 3, "tie", [inn(1, 130, 120), inn(3, 130, 120)]),
            match(2, 3, "no_result", []),
        ],
    })
    assert.deepEqual(
        rows.map((row) => [row.team.name, row.played, row.won, row.lost, row.tied, row.noResult, row.points]),
        [
            ["Reds", 2, 1, 0, 1, 0, 3],
            ["Greens", 2, 0, 0, 1, 1, 2],
            ["Blues", 2, 0, 1, 0, 1, 1],
            ["Golds", 0, 0, 0, 0, 0, 0],
        ],
    )
    assert.deepEqual(rows.map((row) => row.position), [1, 2, 3, 4])
    assert.equal(rowOf(rows, 4).netRunRate, null, "no NRR before playing")
})

check("NRR: runs per over scored minus conceded, rounded to 3 places", () => {
    // Reds 160 in 20 overs (8.0 rpo), Blues 150 in 20 overs (7.5 rpo)
    const rows = buildPointsTable({
        teams: [REDS, BLUES],
        matches: [match(1, 2, { winner: 1 }, [inn(1, 160, 120), inn(2, 150, 120)])],
    })
    assert.equal(rowOf(rows, 1).netRunRate, 0.5)
    assert.equal(rowOf(rows, 2).netRunRate, -0.5)

    // 101 in 17.2 overs (104 balls) chasing 100 in 20 overs: 5.827 - 5.0
    const chase = buildPointsTable({
        teams: [REDS, BLUES],
        matches: [match(1, 2, { winner: 2 }, [inn(1, 100, 120), inn(2, 101, 104)])],
    })
    assert.equal(rowOf(chase, 2).netRunRate, 0.827)
    assert.equal(rowOf(chase, 1).netRunRate, -0.827)
})

check("NRR: an all-out side counts as facing its full overs", () => {
    // Blues all out for 90 in 15 overs: counted as 20 overs (4.5 rpo), Reds 150 in 20 (7.5 rpo)
    const rows = buildPointsTable({
        teams: [REDS, BLUES],
        matches: [match(1, 2, { winner: 1 }, [inn(1, 150, 120), inn(2, 90, 90, true)])],
    })
    assert.equal(rowOf(rows, 2).ballsFaced, 120)
    assert.equal(rowOf(rows, 1).ballsBowled, 120)
    assert.equal(rowOf(rows, 1).netRunRate, 3)
    assert.equal(rowOf(rows, 2).netRunRate, -3)
})

check("order: points, then NRR, then wins, then name", () => {
    const rows = buildPointsTable({
        teams: [GOLDS, GREENS, BLUES, REDS],
        matches: [
            // Reds and Blues both win once; Reds by more
            match(1, 3, { winner: 1 }, [inn(1, 200, 120), inn(3, 100, 120)]),
            match(2, 4, { winner: 2 }, [inn(2, 150, 120), inn(4, 140, 120)]),
        ],
    })
    assert.deepEqual(rows.map((row) => row.team.name), ["Reds", "Blues", "Golds", "Greens"])

    const level = buildPointsTable({ teams: [GREENS, GOLDS], matches: [] })
    assert.deepEqual(level.map((row) => row.team.name), ["Golds", "Greens"], "no points or NRR: by name")
})

check("a Super Over or boundary-count win is a full win (stored as a win)", () => {
    const rows = buildPointsTable({
        teams: [REDS, BLUES],
        matches: [match(1, 2, { winner: 2 }, [inn(1, 120, 120), inn(2, 120, 120)])],
    })
    assert.equal(rowOf(rows, 2).points, 2)
    assert.equal(rowOf(rows, 2).netRunRate, 0, "the tied regular innings give an even NRR")
    assert.equal(rows[0]?.team.name, "Blues")
})

check("form: latest first, at most 5", () => {
    const results: ("W" | "L" | "T")[] = ["W", "L", "W", "T", "W", "L"]
    const matches = results.map((result) =>
        match(1, 2, result === "T" ? "tie" : { winner: result === "W" ? 1 : 2 }, [inn(1, 100, 120), inn(2, 100, 120)]),
    )
    const rows = buildPointsTable({ teams: [REDS, BLUES], matches: [...matches].reverse() })
    assert.deepEqual(rowOf(rows, 1).form, ["L", "W", "T", "W", "L"])
    assert.deepEqual(rowOf(rows, 2).form, ["W", "L", "T", "L", "W"])
})

check("only teams that are listed get rows; their opponents' runs still count for them", () => {
    // Blues are not listed (the service lists removed teams that played, so this only guards the engine)
    const rows = buildPointsTable({
        teams: [REDS],
        matches: [match(1, 2, { winner: 1 }, [inn(1, 150, 120), inn(2, 140, 120)])],
    })
    assert.equal(rows.length, 1)
    assert.equal(rowOf(rows, 1).runsAgainst, 140)
})

console.log(`${passed} standings scenarios passed`)
