// Checks the scoring engine against worked cricket scenarios. Run with: npm run check:scoring
import assert from "node:assert/strict"
import {
    applyBall,
    applyRetirement,
    type BallContext,
    endInnings,
    selectBatter,
    selectBowler,
    swapStrike,
    undoDelivery,
} from "../src/engines/scoring/apply-delivery.js"
import {
    batterOptions,
    bowlerOptions,
    currentOverOf,
    endReasonOf,
    isFreeHitNext,
} from "../src/engines/scoring/innings-state.js"
import { ballLabel } from "../src/engines/scoring/labels.js"
import { buildLiveView } from "../src/engines/scoring/live-view.js"
import { computeResult } from "../src/engines/scoring/result.js"
import { runsRunOf } from "../src/engines/scoring/rotation.js"
import { buildInningsCard } from "../src/engines/scoring/scorecard.js"
import {
    type BallInput,
    type DeliveryRow,
    type InningsSnapshot,
    type MatchRules,
    type PlayerInfo,
    type RuleResult,
} from "../src/engines/scoring/types.js"

// The value of a rule result that must have succeeded
const value = <T>(result: RuleResult<T>): T => {
    if (!result.ok) throw new Error(result.message)
    return result.value
}

const RULES: MatchRules = { oversPerSide: 2, playersPerSide: 11 }
const BATTING: PlayerInfo[] = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, name: `Bat${index + 1}` }))
const BOWLING: PlayerInfo[] = Array.from({ length: 11 }, (_, index) => ({ id: index + 101, name: `Bowl${index + 1}` }))
const NAMES = new Map([...BATTING, ...BOWLING].map((player) => [player.id, player.name]))
const FIELDERS = new Set(BOWLING.map((player) => player.id))

const start = (overrides: Partial<InningsSnapshot> = {}): InningsSnapshot => ({
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    strikerId: 1,
    nonStrikerId: 2,
    bowlerId: 101,
    status: "in_progress",
    endReason: null,
    target: null,
    ...overrides,
})

const ballInput = (overrides: Partial<BallInput> = {}): BallInput => ({
    runs: 0,
    isBoundary: false,
    overthrowRuns: 0,
    extra: null,
    wicket: null,
    ...overrides,
})

const ctxOf = (rows: readonly DeliveryRow[] = [], rules: MatchRules = RULES): BallContext => ({
    ...rules,
    isFreeHit: isFreeHitNext(rows),
    fieldingPlayerIds: FIELDERS,
})

// One innings being scored ball by ball, like the service does
class Innings {
    snapshot: InningsSnapshot
    rows: DeliveryRow[] = []
    rules: MatchRules

    constructor(snapshot: InningsSnapshot = start(), rules: MatchRules = RULES) {
        this.snapshot = snapshot
        this.rules = rules
    }

    ball(input: Partial<BallInput> = {}) {
        const outcome = value(applyBall(this.snapshot, ballInput(input), ctxOf(this.rows, this.rules)))
        this.snapshot = outcome.snapshot
        this.rows.push({ ...outcome.delivery, seq: this.rows.length + 1 })
        return this
    }

    rejected(input: Partial<BallInput>) {
        const result = applyBall(this.snapshot, ballInput(input), ctxOf(this.rows, this.rules))
        assert.equal(result.ok, false, `expected ${JSON.stringify(input)} to be rejected`)
        return result.ok ? "" : result.message
    }

    pickBatter(playerId: number) {
        this.snapshot = value(selectBatter(this.snapshot, playerId, batterOptions(this.rows, BATTING, this.snapshot)))
        return this
    }

    pickBowler(playerId: number) {
        const over = currentOverOf(this.snapshot.legalBalls)
        const balls = this.rows.filter((row) => row.kind === "ball" && row.overNumber === over).length
        const options = bowlerOptions(this.rows, BOWLING, this.snapshot.legalBalls, this.rules)
        this.snapshot = value(selectBowler(this.snapshot, playerId, options, balls))
        return this
    }

    // Six dots by the current bowler, then the next bowler is chosen
    dotOver(nextBowler: number) {
        for (let index = 0; index < 6; index += 1) this.ball()
        return this.pickBowler(nextBowler)
    }

    crease() {
        return [this.snapshot.strikerId, this.snapshot.nonStrikerId]
    }

    undo() {
        const last = this.rows.pop()
        if (!last) throw new Error("nothing to undo")
        this.snapshot = undoDelivery(this.snapshot, last)
        return this
    }
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

// Rotation: who is on strike after the ball (striker 1, non-striker 2 to start)
check("odd runs change the strike, even runs and boundaries do not", () => {
    assert.deepEqual(new Innings().ball({ runs: 1 }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 3 }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 5 }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 2 }).crease(), [1, 2])
    assert.deepEqual(new Innings().ball({ runs: 0 }).crease(), [1, 2])
    assert.deepEqual(new Innings().ball({ runs: 4, isBoundary: true }).crease(), [1, 2])
    assert.deepEqual(new Innings().ball({ runs: 6, isBoundary: true }).crease(), [1, 2])
})

check("wides, no balls, byes and leg byes", () => {
    const wide = new Innings().ball({ extra: { type: "wide", runKind: "bat" } })
    assert.deepEqual(wide.crease(), [1, 2])
    assert.equal(wide.snapshot.legalBalls, 0)
    assert.equal(wide.snapshot.runs, 1)
    assert.deepEqual(new Innings().ball({ runs: 2, extra: { type: "wide", runKind: "bat" } }).crease(), [1, 2])
    assert.deepEqual(new Innings().ball({ runs: 1, extra: { type: "wide", runKind: "bat" } }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 4, isBoundary: true, extra: { type: "wide", runKind: "bat" } }).crease(), [1, 2])

    const noBall = new Innings().ball({ runs: 1, extra: { type: "no_ball", runKind: "bat" } })
    assert.deepEqual(noBall.crease(), [2, 1])
    assert.equal(noBall.snapshot.legalBalls, 0)
    assert.equal(noBall.snapshot.runs, 2)
    assert.equal(noBall.rows[0]?.runsOffBat, 1)

    assert.deepEqual(new Innings().ball({ runs: 1, extra: { type: "leg_bye", runKind: "bat" } }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 3, extra: { type: "bye", runKind: "bat" } }).crease(), [2, 1])
    assert.deepEqual(new Innings().ball({ runs: 2, extra: { type: "bye", runKind: "bat" } }).crease(), [1, 2])
    const noBallBye = new Innings().ball({ runs: 2, extra: { type: "no_ball", runKind: "bye" } })
    assert.equal(noBallBye.rows[0]?.byes, 2)
    assert.equal(noBallBye.snapshot.runs, 3)
})

check("overthrows: runs run decide the strike, a boundary overthrow is not run", () => {
    // ran 1, overthrow 1 -> 2 runs run
    assert.deepEqual(new Innings().ball({ runs: 2, overthrowRuns: 1 }).crease(), [1, 2])
    // ran 1, overthrow 2 all run -> 3 runs run
    assert.deepEqual(new Innings().ball({ runs: 3, overthrowRuns: 2 }).crease(), [2, 1])
    // ran 1, then 4 overthrows to the boundary -> only 1 run
    const boundaryOdd = new Innings().ball({ runs: 5, overthrowRuns: 4, isBoundary: true })
    assert.deepEqual(boundaryOdd.crease(), [2, 1])
    assert.equal(boundaryOdd.rows[0]?.runsRun, 1)
    assert.equal(boundaryOdd.snapshot.runs, 5)
    // ran 2, then 4 overthrows -> 2 runs run
    assert.deepEqual(new Innings().ball({ runs: 6, overthrowRuns: 4, isBoundary: true }).crease(), [1, 2])
    // overthrow on a bye: 1 bye + 1 overthrow
    assert.deepEqual(new Innings().ball({ runs: 2, overthrowRuns: 1, extra: { type: "bye", runKind: "bat" } }).crease(), [1, 2])
    // overthrow on a wide
    const wideOverthrow = new Innings().ball({ runs: 4, overthrowRuns: 4, isBoundary: true, extra: { type: "wide", runKind: "bat" } })
    assert.deepEqual(wideOverthrow.crease(), [1, 2])
    assert.equal(wideOverthrow.snapshot.runs, 5)
    // overthrow only (ran nothing before the throw): 4 -> not run
    assert.equal(runsRunOf({ runsOffBat: 4, wides: 0, byes: 0, legByes: 0, overthrowRuns: 4, isBoundary: true }), 0)
})

check("end of an over: even runs change the strike once, odd runs leave the same batter on strike", () => {
    const lastBall = (input: Partial<BallInput>) => new Innings(start({ legalBalls: 5 })).ball(input)
    for (const input of [{ runs: 0 }, { runs: 2 }, { runs: 4, isBoundary: true }, { runs: 6, isBoundary: true }]) {
        const innings = lastBall(input)
        assert.deepEqual(innings.crease(), [2, 1], `even runs ${JSON.stringify(input)}`)
        assert.equal(innings.snapshot.bowlerId, null)
    }
    for (const input of [{ runs: 1 }, { runs: 3 }, { runs: 5 }]) {
        const innings = lastBall(input)
        assert.deepEqual(innings.crease(), [1, 2], `odd runs ${JSON.stringify(input)}`)
        assert.equal(innings.snapshot.bowlerId, null)
    }
    // a wide on the last ball does not finish the over
    const wide = new Innings(start({ legalBalls: 5 })).ball({ extra: { type: "wide", runKind: "bat" } })
    assert.equal(wide.snapshot.bowlerId, 101)
    assert.deepEqual(wide.crease(), [1, 2])
})

check("wickets leave an empty place and the next ball is blocked until the batter is chosen", () => {
    const innings = new Innings().ball({ wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } })
    assert.deepEqual(innings.crease(), [null, 2])
    assert.equal(innings.snapshot.wickets, 1)
    assert.match(innings.rejected({ runs: 1 }), /next batter/)
    innings.pickBatter(3)
    assert.deepEqual(innings.crease(), [3, 2])
    innings.ball({ runs: 1 })
    assert.deepEqual(innings.crease(), [2, 3])
})

check("wicket on the last ball: the empty place ends up at the non-striker end", () => {
    const innings = new Innings(start({ legalBalls: 5 })).ball({
        wicket: { type: "caught", dismissedPlayerId: null, fielderId: 105 },
    })
    assert.deepEqual(innings.crease(), [2, null])
    assert.equal(innings.snapshot.bowlerId, null)
    innings.pickBatter(3)
    assert.deepEqual(innings.crease(), [2, 3])
    assert.match(innings.rejected({ runs: 1 }), /next bowler/)
    innings.pickBowler(102)
    innings.ball({ runs: 1 })
    assert.deepEqual(innings.crease(), [3, 2])
})

check("run out: either batter can be out, the empty place is the one they now stand in", () => {
    const nonStriker = new Innings().ball({
        runs: 1,
        wicket: { type: "run_out", dismissedPlayerId: 2, fielderId: 103 },
    })
    // after the run the batters changed ends (striker 2), then 2 is out
    assert.deepEqual(nonStriker.crease(), [null, 1])

    const striker = new Innings().ball({
        runs: 0,
        wicket: { type: "run_out", dismissedPlayerId: 1, fielderId: null },
    })
    assert.deepEqual(striker.crease(), [null, 2])

    assert.match(
        new Innings().rejected({ wicket: { type: "run_out", dismissedPlayerId: null, fielderId: null } }),
        /which batter/,
    )
    assert.match(
        new Innings().rejected({ wicket: { type: "run_out", dismissedPlayerId: 5, fielderId: null } }),
        /not at the crease/,
    )
})

check("wicket rules: fielder, runs and dismissal types", () => {
    const innings = new Innings()
    assert.match(innings.rejected({ wicket: { type: "caught", dismissedPlayerId: null, fielderId: null } }), /fielder/)
    assert.match(innings.rejected({ wicket: { type: "caught", dismissedPlayerId: null, fielderId: 3 } }), /bowling team/)
    assert.match(innings.rejected({ runs: 1, wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } }), /No runs/)
    assert.match(innings.rejected({ wicket: { type: "bowled", dismissedPlayerId: 2, fielderId: null } }), /on strike/)
    assert.match(innings.rejected({ extra: { type: "wide", runKind: "bat" }, wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } }), /On a wide/)
    assert.match(innings.rejected({ extra: { type: "no_ball", runKind: "bat" }, wicket: { type: "stumped", dismissedPlayerId: null, fielderId: 101 } }), /On a no ball/)
    // stumped off a wide is fine and the ball does not count
    const stumped = new Innings().ball({
        extra: { type: "wide", runKind: "bat" },
        wicket: { type: "stumped", dismissedPlayerId: null, fielderId: 102 },
    })
    assert.equal(stumped.snapshot.wickets, 1)
    assert.equal(stumped.snapshot.legalBalls, 0)
})

check("run validation", () => {
    const innings = new Innings()
    assert.match(innings.rejected({ runs: 3, isBoundary: true }), /4 or 6/)
    assert.match(innings.rejected({ runs: 0, isBoundary: true }), /4 or 6/)
    assert.match(innings.rejected({ runs: 6, isBoundary: true, extra: { type: "bye", runKind: "bat" } }), /4 or 6/)
    assert.match(innings.rejected({ runs: 1, overthrowRuns: 2 }), /overthrow/)
    assert.match(innings.rejected({ runs: 5, overthrowRuns: 3, isBoundary: true }), /worth 4/)
    assert.match(innings.rejected({ runs: 0, extra: { type: "bye", runKind: "bat" } }), /byes/)
    assert.match(innings.rejected({ runs: 10 }), /not possible/)
})

check("free hit follows a no ball, even into the next over", () => {
    const innings = new Innings(start({ legalBalls: 5 })).ball({ extra: { type: "no_ball", runKind: "bat" } })
    assert.equal(isFreeHitNext(innings.rows), true)
    innings.ball({ runs: 0 }) // the free hit is a legal ball and finishes the over
    assert.equal(innings.rows[1]?.isFreeHit, true)
    assert.equal(isFreeHitNext(innings.rows), false)

    const second = new Innings().ball({ extra: { type: "no_ball", runKind: "bat" } })
    assert.match(second.rejected({ wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } }), /free hit/)
    second.ball({ runs: 1, wicket: { type: "run_out", dismissedPlayerId: 1, fielderId: 104 } })
    assert.equal(second.snapshot.wickets, 1)

    // a free hit that is itself a no-ball gives another free hit
    const third = new Innings().ball({ extra: { type: "no_ball", runKind: "bat" } }).ball({ extra: { type: "no_ball", runKind: "bat" } })
    assert.equal(isFreeHitNext(third.rows), true)
})

check("innings end: all out, overs complete, target reached", () => {
    const tenDown = new Innings(start({ wickets: 9 })).ball({
        wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null },
    })
    assert.equal(tenDown.snapshot.status, "completed")
    assert.equal(tenDown.snapshot.endReason, "all_out")
    assert.match(tenDown.rejected({ runs: 1 }), /over/)

    const lastBall = new Innings(start({ legalBalls: 11, bowlerId: 101 })).ball({ runs: 1 })
    assert.equal(lastBall.snapshot.endReason, "overs_complete")

    const chase = new Innings(start({ target: 10, runs: 7, legalBalls: 3 })).ball({ runs: 3 })
    assert.equal(chase.snapshot.endReason, "target_reached")
    const notYet = new Innings(start({ target: 10, runs: 7 })).ball({ runs: 2 })
    assert.equal(notYet.snapshot.status, "in_progress")

    // a small team is all out earlier
    assert.equal(endReasonOf({ runs: 0, wickets: 4, legalBalls: 0, target: null }, { oversPerSide: 5, playersPerSide: 5 }), "all_out")
    // the target beats all out on the same ball
    assert.equal(endReasonOf({ runs: 12, wickets: 10, legalBalls: 5, target: 12 }, RULES), "target_reached")
})

check("undo restores the score and the crease, also after a wicket or the end of an over", () => {
    const innings = new Innings(start({ legalBalls: 5 })).ball({
        wicket: { type: "caught", dismissedPlayerId: null, fielderId: 105 },
    })
    const wicketBall = innings.rows.length
    assert.equal(wicketBall, 1)
    innings.undo()
    assert.deepEqual(innings.crease(), [1, 2])
    assert.equal(innings.snapshot.bowlerId, 101)
    assert.equal(innings.snapshot.wickets, 0)
    assert.equal(innings.snapshot.legalBalls, 5)

    const ended = new Innings(start({ wickets: 9 })).ball({
        runs: 2,
        wicket: { type: "run_out", dismissedPlayerId: 2, fielderId: null },
    })
    assert.equal(ended.snapshot.status, "completed")
    ended.undo()
    assert.equal(ended.snapshot.status, "in_progress")
    assert.equal(ended.snapshot.endReason, null)
    assert.equal(ended.snapshot.runs, 0)
    assert.equal(ended.snapshot.wickets, 9)
})

check("swap strike", () => {
    const innings = new Innings()
    const swapped = swapStrike(innings.snapshot)
    assert.ok(swapped.ok)
    if (swapped.ok) assert.deepEqual([swapped.value.strikerId, swapped.value.nonStrikerId], [2, 1])
    assert.equal(swapStrike(start({ strikerId: null })).ok, false)
})

check("retirement: retired hurt is not a wicket and the batter may return", () => {
    const innings = new Innings().ball({ runs: 1 }) // striker is now 2
    const retire = applyRetirement(innings.snapshot, { playerId: 2, type: "retired_hurt" }, RULES)
    assert.ok(retire.ok)
    if (!retire.ok) return
    innings.snapshot = retire.value.snapshot
    innings.rows.push({ ...retire.value.delivery, seq: 2 })
    assert.equal(innings.snapshot.wickets, 0)
    assert.deepEqual(innings.crease(), [null, 1])
    const options = batterOptions(innings.rows, BATTING, innings.snapshot)
    assert.equal(options.find((option) => option.id === 2)?.retiredHurt, true)
    innings.pickBatter(2) // returns
    innings.ball({ runs: 1 })
    assert.equal(batterOptions(innings.rows, BATTING, innings.snapshot).find((option) => option.id === 2)?.retiredHurt ?? false, false)
    assert.equal(applyRetirement(innings.snapshot, { playerId: 9, type: "retired_hurt" }, RULES).ok, false)

    const retiredOut = applyRetirement(start(), { playerId: 1, type: "retired_out" }, RULES)
    assert.ok(retiredOut.ok)
    if (retiredOut.ok) assert.equal(retiredOut.value.snapshot.wickets, 1)

    // cannot retire while a pick is pending
    assert.equal(applyRetirement(start({ strikerId: null }), { playerId: 2, type: "retired_hurt" }, RULES).ok, false)
})

check("picking batters and bowlers: availability rules", () => {
    const innings = new Innings().ball({ wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } })
    const options = batterOptions(innings.rows, BATTING, innings.snapshot)
    assert.deepEqual(options.map((option) => option.id), [3, 4, 5, 6, 7, 8, 9, 10, 11])
    assert.equal(selectBatter(innings.snapshot, 1, options).ok, false, "the dismissed batter cannot come back")
    assert.equal(selectBatter(innings.snapshot, 2, options).ok, false, "a batter already at the crease cannot be picked")
    assert.equal(selectBatter(start(), 3, options).ok, false, "no empty place")

    // bowler of the last over and bowlers at their quota are not offered (2 overs match: quota 1)
    const match = new Innings()
    match.dotOver(102)
    const secondOver = bowlerOptions(match.rows, BOWLING, match.snapshot.legalBalls, RULES)
    assert.equal(secondOver.find((option) => option.id === 101)?.disabledReason !== null, true)
    assert.equal(secondOver.find((option) => option.id === 103)?.disabledReason, null)
    assert.equal(selectBowler(start({ bowlerId: null, legalBalls: 6 }), 101, secondOver, 0).ok, false)

    // the bowler can be changed before the first ball of the over, not after
    match.pickBowler(103)
    match.ball()
    assert.equal(selectBowler(match.snapshot, 104, secondOver, 1).ok, false)
})

check("bowler quota is relaxed for the last-over rule only when nobody else is left", () => {
    const rules: MatchRules = { oversPerSide: 10, playersPerSide: 5 }
    const rows = new Innings(start({ bowlerId: 101 }), rules)
    const five = BOWLING.slice(0, 5)
    // each of the 5 bowlers bowls 2 overs: 10 overs
    const order = [101, 102, 103, 104, 105, 101, 102, 103, 104]
    order.forEach((bowler, index) => {
        if (index > 0) rows.pickBowler(bowler)
        for (let ball = 0; ball < 6; ball += 1) rows.ball()
    })
    const options = bowlerOptions(rows.rows, five, rows.snapshot.legalBalls, rules)
    const open = options.filter((option) => option.disabledReason === null).map((option) => option.id)
    assert.deepEqual(open, [105])
})

check("manual end of innings", () => {
    const ended = endInnings(start())
    assert.ok(ended.ok)
    if (ended.ok) assert.equal(ended.value.endReason, "ended_by_scorer")
    assert.equal(endInnings({ ...start(), status: "completed", endReason: "all_out" }).ok, false)
})

check("ball labels", () => {
    const labels = new Innings()
        .ball({ runs: 0 })
        .ball({ runs: 1 })
        .ball({ runs: 4, isBoundary: true })
        .ball({ extra: { type: "wide", runKind: "bat" } })
        .ball({ runs: 2, extra: { type: "wide", runKind: "bat" } })
        .ball({ runs: 4, extra: { type: "no_ball", runKind: "bat" } })
        .ball({ runs: 1, extra: { type: "leg_bye", runKind: "bat" } })
        .ball({ runs: 2, extra: { type: "bye", runKind: "bat" } })
        .ball({ runs: 2, extra: { type: "no_ball", runKind: "bye" } })
        .ball({ runs: 5, overthrowRuns: 4, isBoundary: true })
    assert.deepEqual(labels.rows.map(ballLabel), ["0", "1", "4", "Wd", "Wd+2", "Nb+4", "Lb1", "B2", "Nb+B2", "1+OT4"])

    const wickets = new Innings()
        .ball({ wicket: { type: "bowled", dismissedPlayerId: null, fielderId: null } })
        .pickBatter(3)
        .ball({ runs: 1, wicket: { type: "run_out", dismissedPlayerId: 3, fielderId: 104 } })
    assert.deepEqual(wickets.rows.map(ballLabel), ["W", "1+W"])
})

// A short innings scored through, then the scorecard checked line by line
check("scorecard: batting, bowling, extras, fall of wickets, maiden and timeline", () => {
    const innings = new Innings()
    // Over 1 by Bowl1: 1, 4, wide, 0, 6, 2 (1 of them an overthrow), 0 -> 7 balls, 6 legal
    innings
        .ball({ runs: 1 }) // Bat1 1, strike -> Bat2
        .ball({ runs: 4, isBoundary: true }) // Bat2 4
        .ball({ extra: { type: "wide", runKind: "bat" } }) // wide
        .ball({ runs: 0 }) // Bat2 dot
        .ball({ runs: 6, isBoundary: true }) // Bat2 6
        .ball({ runs: 2, overthrowRuns: 1 }) // Bat2 2, no swap
        .ball({ runs: 0 }) // 6th legal ball: dot, so the batters change ends for the new over
    assert.equal(innings.snapshot.legalBalls, 6)
    assert.equal(innings.snapshot.runs, 14)
    assert.deepEqual(innings.crease(), [1, 2])
    innings.pickBowler(102)
    // Over 2 by Bowl2: a maiden (the leg bye is not charged to the bowler)
    innings
        .ball({ runs: 0 })
        .ball({ runs: 1, extra: { type: "leg_bye", runKind: "bat" } }) // Bat1 faces; leg bye 1 -> swap
        .ball({ runs: 0 })
        .ball({ runs: 0 })
        .ball({ runs: 0 })
        .ball({ runs: 0 })
    assert.equal(innings.snapshot.status, "completed")
    assert.equal(innings.snapshot.endReason, "overs_complete")

    const card = buildInningsCard(innings.rows, { battingPlayers: BATTING, names: NAMES, strikerId: innings.snapshot.strikerId, nonStrikerId: innings.snapshot.nonStrikerId })

    assert.equal(card.total.runs, 15)
    assert.equal(card.total.overs, "2.0")
    assert.equal(card.total.runRate, 7.5)
    assert.equal(card.extras.wides, 1)
    assert.equal(card.extras.legByes, 1)
    assert.equal(card.extras.total, 2)

    const bat1 = card.batting.find((line) => line.playerId === 1)
    const bat2 = card.batting.find((line) => line.playerId === 2)
    assert.deepEqual([bat1?.runs, bat1?.balls, bat1?.fours, bat1?.sixes], [1, 3, 0, 0])
    assert.deepEqual([bat2?.runs, bat2?.balls, bat2?.fours, bat2?.sixes], [12, 9, 1, 1])
    assert.equal(bat2?.strikeRate, 133.3)
    assert.equal(bat1?.strikeRate, 33.3)
    assert.equal(bat1?.status, "not_out")
    assert.equal(card.didNotBat.length, 9)

    const bowl1 = card.bowling.find((line) => line.playerId === 101)
    const bowl2 = card.bowling.find((line) => line.playerId === 102)
    assert.deepEqual([bowl1?.overs, bowl1?.runs, bowl1?.maidens, bowl1?.wides, bowl1?.dots], ["1.0", 14, 0, 1, 2])
    assert.equal(bowl1?.economy, 14)
    assert.deepEqual([bowl2?.overs, bowl2?.runs, bowl2?.maidens, bowl2?.dots], ["1.0", 0, 1, 6])
    assert.equal(bowl2?.economy, 0)

    assert.equal(card.overs.length, 2)
    assert.deepEqual(card.overs[0]?.balls, ["1", "4", "Wd", "0", "6", "1+OT1", "0"])
    assert.equal(card.overs[0]?.runs, 14)
    assert.equal(card.overs[1]?.bowler, "Bowl2")
})

check("scorecard: wickets, how out, fall of wickets, retirements and returning batters", () => {
    const innings = new Innings()
    innings
        .ball({ runs: 2 }) // Bat1 2
        .ball({ wicket: { type: "caught", dismissedPlayerId: null, fielderId: 105 } }) // Bat1 c Bowl5 b Bowl1 (2/1)
        .pickBatter(3)
        .ball({ runs: 1 }) // Bat3 1 -> strike Bat2
        .ball({ runs: 3, wicket: { type: "run_out", dismissedPlayerId: 2, fielderId: 104 } }) // Bat2 run out after 3 runs
        .pickBatter(4)
    // cannot retire while a batter is missing, so this comes after the pick
    const retire = applyRetirement(innings.snapshot, { playerId: 3, type: "retired_hurt" }, RULES)
    assert.ok(retire.ok)
    if (retire.ok) {
        innings.snapshot = retire.value.snapshot
        innings.rows.push({ ...retire.value.delivery, seq: innings.rows.length + 1 })
    }

    const card = buildInningsCard(innings.rows, { battingPlayers: BATTING, names: NAMES, strikerId: innings.snapshot.strikerId, nonStrikerId: innings.snapshot.nonStrikerId })
    const byId = (id: number) => card.batting.find((line) => line.playerId === id)
    assert.deepEqual([byId(1)?.status, byId(1)?.howOut], ["out", "c Bowl5 b Bowl1"])
    assert.equal(byId(2)?.howOut, "run out (Bowl4)")
    assert.deepEqual([byId(3)?.status, byId(3)?.howOut], ["retired_hurt", "retired hurt"])
    assert.deepEqual(card.fallOfWickets.map((entry) => [entry.wicketNumber, entry.runs, entry.name, entry.over]), [
        [1, 2, "Bat1", "0.2"],
        [2, 6, "Bat2", "0.4"],
    ])
    assert.equal(card.total.wickets, 2)
    // run out batter is not credited to the bowler
    assert.equal(card.bowling[0]?.wickets, 1)
    // the retired batter, then two empty places: card shows them and the live view asks for a batter
    const live = buildLiveView({
        snapshot: innings.snapshot,
        rows: innings.rows,
        battingPlayers: BATTING,
        bowlingPlayers: BOWLING,
        names: NAMES,
        rules: RULES,
    })
    assert.equal(live.pending, "batter")
    assert.equal(live.availableBatters.some((option) => option.id === 3 && option.retiredHurt), true)
    assert.equal(live.availableBatters.some((option) => option.id === 1 || option.id === 2), false)
    assert.equal(live.canUndo, true)
})

check("live view: pending picks, this over, chase numbers", () => {
    const innings = new Innings(start({ target: 20 }))
    innings.ball({ runs: 1 }).ball({ runs: 4, isBoundary: true })
    let live = buildLiveView({ snapshot: innings.snapshot, rows: innings.rows, battingPlayers: BATTING, bowlingPlayers: BOWLING, names: NAMES, rules: RULES })
    assert.equal(live.pending, null)
    assert.deepEqual(live.thisOver, ["1", "4"])
    assert.equal(live.striker?.name, "Bat2")
    assert.equal(live.requiredRuns, 15)
    assert.equal(live.ballsRemaining, 10)
    assert.equal(live.requiredRate, 9)
    assert.equal(live.canChangeBowler, false)

    for (let index = 0; index < 4; index += 1) innings.ball()
    live = buildLiveView({ snapshot: innings.snapshot, rows: innings.rows, battingPlayers: BATTING, bowlingPlayers: BOWLING, names: NAMES, rules: RULES })
    assert.equal(live.pending, "bowler")
    assert.equal(live.thisOver.length, 6, "the finished over stays on screen until the next bowler is chosen")
    assert.equal(live.availableBowlers.find((option) => option.id === 101)?.disabledReason !== null, true)

    innings.pickBowler(102)
    live = buildLiveView({ snapshot: innings.snapshot, rows: innings.rows, battingPlayers: BATTING, bowlingPlayers: BOWLING, names: NAMES, rules: RULES })
    assert.equal(live.pending, null)
    assert.deepEqual(live.thisOver, [])
    assert.equal(live.canChangeBowler, true)
    assert.equal(live.bowler?.name, "Bowl2")
})

check("match result", () => {
    const first = { teamId: 1, name: "Reds", runs: 100 }
    assert.deepEqual(computeResult({ first, second: { teamId: 2, name: "Blues", runs: 101, wickets: 4 }, playersPerSide: 11 }), {
        resultType: "win",
        winnerTeamId: 2,
        summary: "Blues won by 6 wickets",
    })
    assert.equal(computeResult({ first, second: { teamId: 2, name: "Blues", runs: 101, wickets: 9 }, playersPerSide: 11 }).summary, "Blues won by 1 wicket")
    assert.equal(computeResult({ first, second: { teamId: 2, name: "Blues", runs: 88, wickets: 10 }, playersPerSide: 11 }).summary, "Reds won by 12 runs")
    assert.equal(computeResult({ first, second: { teamId: 2, name: "Blues", runs: 99, wickets: 10 }, playersPerSide: 11 }).summary, "Reds won by 1 run")
    assert.deepEqual(computeResult({ first, second: { teamId: 2, name: "Blues", runs: 100, wickets: 10 }, playersPerSide: 11 }), {
        resultType: "tie",
        winnerTeamId: null,
        summary: "Match tied",
    })
})

console.log(`${passed} scoring scenarios passed`)
