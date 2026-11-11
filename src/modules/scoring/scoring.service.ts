import { db } from "../../db/postgres.js"
import {
    applyBall,
    applyRetirement,
    endInnings,
    selectBatter,
    selectBowler,
    swapStrike,
    undoDelivery,
} from "../../engines/scoring/apply-delivery.js"
import { oversText, round } from "../../engines/scoring/delivery-math.js"
import {
    ballsBowledInOver,
    batterOptions,
    bowlerOptions,
    currentOverOf,
    isFreeHitNext,
} from "../../engines/scoring/innings-state.js"
import { buildLiveView } from "../../engines/scoring/live-view.js"
import { NOTHING_TO_UNDO } from "../../engines/scoring/messages.js"
import { computeResult } from "../../engines/scoring/result.js"
import { buildInningsCard } from "../../engines/scoring/scorecard.js"
import {
    type BallInput,
    type DeliveryKind,
    type DeliveryRow,
    fail,
    type InningsEndReason,
    type InningsSnapshot,
    type InningsStatus,
    type MatchRules,
    type NewDelivery,
    ok,
    type PlayerInfo,
    type RuleResult,
    type WicketType,
} from "../../engines/scoring/types.js"
import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/http/errors.js"
import { assertScoringOpen, getMatch } from "../matches/matches.service.js"
import { todayInTimezone } from "../../shared/utils/date.js"
import { getMatchPlayers } from "../squads/squads.service.js"
import { TOURNAMENT_TIMEZONE } from "../tournaments/tournaments.constants.js"
import {
    BOTH_INNINGS_STARTED,
    FIRST_INNINGS_NOT_OVER,
    INNINGS_NOT_FOUND,
    MATCH_ALREADY_COMPLETED,
    MATCH_NOT_READY,
    MATCH_OVER,
    NEXT_INNINGS_STARTED,
    OPENING_BATTER_NOT_IN_XI,
    OPENING_BOWLER_NOT_IN_XI,
    SCORE_CHANGED,
    SCORECARD_CACHE_CONTROL_COMPLETED,
    SCORECARD_CACHE_CONTROL_LIVE,
} from "./scoring.constants.js"
import {
    type DeliveryRecord,
    findInningsOfMatch,
    findLastSeq,
    findLiveDeliveries,
    findLiveDeliveriesOfMatch,
    findScorecardFingerprint,
    type InningsRow,
    inTransaction,
    insertDelivery,
    insertInnings,
    lockInnings,
    lockMatch,
    lockMatchState,
    markScoringStarted,
    saveMatchResult,
    updateInnings,
    voidDelivery,
} from "./scoring.repository.js"
import { createScorecardCache } from "./scorecard-cache.js"
import {
    type ChooseBatterInput,
    type ChooseBowlerInput,
    type RecordBallInput,
    type RetireInput,
    type StartInningsInput,
} from "./scoring.schema.js"

type Match = Awaited<ReturnType<typeof assertScoringOpen>>
type Player = Awaited<ReturnType<typeof getMatchPlayers>>[number]

// --- Small helpers ---------------------------------------------------------------------------------------------

// A team's playing XI in batting order (substitutes cannot bat or bowl)
const playingXi = (players: readonly Player[], teamId: number): PlayerInfo[] =>
    players
        .filter((player) => player.teamId === teamId && player.squad === "playing")
        .sort((a, b) => a.position - b.position)
        .map(({ id, name }) => ({ id, name }))

// Everyone of a team, playing and substitutes: any of them may field
const squadIds = (players: readonly Player[], teamId: number) =>
    new Set(players.filter((player) => player.teamId === teamId).map((player) => player.id))

const namesOf = (players: readonly Player[]) => new Map(players.map((player) => [player.id, player.name]))

const teamOf = (match: Match, teamId: number) => (match.teamA.id === teamId ? match.teamA : match.teamB)

// The rules that depend on the match; the overs are always set once an innings exists (they are locked then)
const rulesOf = (match: Match): MatchRules => {
    if (match.oversPerSide === null) throw new BadRequestError(MATCH_NOT_READY)
    return { oversPerSide: match.oversPerSide, playersPerSide: match.tournament.playersPerSide }
}

const toEngineRow = (record: DeliveryRecord): DeliveryRow => ({
    seq: record.seq,
    kind: record.kind as DeliveryKind,
    overNumber: record.overNumber,
    ballsInOver: record.ballsInOver,
    isLegal: record.isLegal,
    strikerId: record.strikerId,
    nonStrikerId: record.nonStrikerId,
    bowlerId: record.bowlerId,
    runsOffBat: record.runsOffBat,
    isBoundary: record.isBoundary,
    wides: record.wides,
    noBalls: record.noBalls,
    byes: record.byes,
    legByes: record.legByes,
    overthrowRuns: record.overthrowRuns,
    runsRun: record.runsRun,
    isFreeHit: record.isFreeHit,
    wicketType: record.wicketType as WicketType | null,
    dismissedPlayerId: record.dismissedPlayerId,
    fielderId: record.fielderId,
})

const snapshotOf = (row: InningsRow): InningsSnapshot => ({
    runs: row.runs,
    wickets: row.wickets,
    legalBalls: row.legalBalls,
    strikerId: row.strikerId,
    nonStrikerId: row.nonStrikerId,
    bowlerId: row.bowlerId,
    status: row.status as InningsStatus,
    endReason: row.endReason as InningsEndReason | null,
    target: row.target,
})

const inningsSummary = (row: InningsRow) => ({
    number: row.inningsNumber,
    battingTeamId: row.battingTeamId,
    bowlingTeamId: row.bowlingTeamId,
    status: row.status as InningsStatus,
    endReason: row.endReason as InningsEndReason | null,
    target: row.target,
    runs: row.runs,
    wickets: row.wickets,
    legalBalls: row.legalBalls,
    overs: oversText(row.legalBalls, BALLS_PER_OVER),
    version: row.version,
})

// --- Reading ---------------------------------------------------------------------------------------------------

// Everything the scorer's screen needs, worked out from the stored deliveries
const buildState = async (match: Match) => {
    const players = await getMatchPlayers(match.id)
    const list = await findInningsOfMatch(db, match.id)
    const latest = list[list.length - 1]

    let current = null
    if (latest) {
        const rows = (await findLiveDeliveries(db, latest.id)).map(toEngineRow)
        const view = buildLiveView({
            snapshot: snapshotOf(latest),
            rows,
            battingPlayers: playingXi(players, latest.battingTeamId),
            bowlingPlayers: playingXi(players, latest.bowlingTeamId),
            names: namesOf(players),
            rules: rulesOf(match),
        })
        // A finished match is final: nothing can be taken back any more
        current = { ...inningsSummary(latest), ...view, canUndo: view.canUndo && !match.completedAt }
    }

    const first = list[0]
    const nextInnings = list.length === 0 ? 1 : list.length === 1 && first?.status === "completed" ? 2 : null

    return {
        match,
        players,
        innings: list.map(inningsSummary),
        current,
        // The innings the scorer can start next (null while one is in progress or after the second)
        nextInnings,
    }
}

// The scorer's resume state: the match, both innings and the live view of the latest one
export const getScoringState = async (matchId: number) => buildState(await assertScoringOpen(matchId))

// Public scorecard of a match: both innings with every stat, generated from the deliveries
export const getScorecard = async (matchId: number) => {
    const match = await getMatch(matchId)
    const players = await getMatchPlayers(matchId)
    const list = await findInningsOfMatch(db, matchId)
    const records = await findLiveDeliveriesOfMatch(db, matchId)
    const names = namesOf(players)

    return {
        match,
        innings: list.map((row) => {
            const rows = records.filter((record) => record.inningsId === row.id).map(toEngineRow)
            const card = buildInningsCard(rows, {
                battingPlayers: playingXi(players, row.battingTeamId),
                names,
                strikerId: row.strikerId,
                nonStrikerId: row.nonStrikerId,
            })

            // The chasing side's target while it is still batting
            const ballsRemaining = Math.max((match.oversPerSide ?? 0) * BALLS_PER_OVER - card.total.legalBalls, 0)
            const requiredRuns = row.target === null ? null : Math.max(row.target - card.total.runs, 0)
            const chase =
                row.target === null || row.status === "completed"
                    ? null
                    : {
                          target: row.target,
                          requiredRuns,
                          ballsRemaining,
                          requiredRate:
                              requiredRuns !== null && ballsRemaining > 0
                                  ? round(requiredRuns / (ballsRemaining / BALLS_PER_OVER), 2)
                                  : null,
                      }

            return {
                number: row.inningsNumber,
                battingTeam: teamOf(match, row.battingTeamId),
                bowlingTeam: teamOf(match, row.bowlingTeamId),
                status: row.status as InningsStatus,
                endReason: row.endReason as InningsEndReason | null,
                target: row.target,
                chase,
                ...card,
            }
        }),
    }
}

const scorecardCache = createScorecardCache({
    readFingerprint: findScorecardFingerprint,
    build: getScorecard,
    today: () => todayInTimezone(TOURNAMENT_TIMEZONE),
})

// The public scorecard for polling: served from the cache, with the etag and cache headers the controller sends
export const getScorecardSnapshot = async (matchId: number) => {
    const { etag, body, completed } = await scorecardCache.get(matchId)
    return {
        etag,
        body,
        cacheControl: completed ? SCORECARD_CACHE_CONTROL_COMPLETED : SCORECARD_CACHE_CONTROL_LIVE,
    }
}

// --- Starting an innings ---------------------------------------------------------------------------------------

// The toss and the overs are set and both teams named their full playing XI
const assertReadyToScore = (match: Match, players: readonly Player[]) => {
    if (match.tossWinnerTeamId === null || match.oversPerSide === null) throw new BadRequestError(MATCH_NOT_READY)
    for (const team of [match.teamA, match.teamB]) {
        if (playingXi(players, team.id).length < match.tournament.playersPerSide) throw new BadRequestError(MATCH_NOT_READY)
    }
}

const otherTeamId = (match: Match, teamId: number) => (match.teamA.id === teamId ? match.teamB.id : match.teamA.id)

// The team that bats first: the toss winner if it chose to bat, else the other team
const firstBattingTeamId = (match: Match, tossWinnerTeamId: number) =>
    match.tossDecision === "bat" ? tossWinnerTeamId : otherTeamId(match, tossWinnerTeamId)

// Start the first innings (or the second, once the first is over) with the opening batters and bowler
export const startInnings = async (matchId: number, input: StartInningsInput) => {
    const match = await assertScoringOpen(matchId)
    if (match.completedAt) throw new ConflictError(MATCH_ALREADY_COMPLETED)

    const players = await getMatchPlayers(matchId)
    assertReadyToScore(match, players)
    const tossWinnerTeamId = match.tossWinnerTeamId
    if (tossWinnerTeamId === null) throw new BadRequestError(MATCH_NOT_READY)

    await inTransaction(async (tx) => {
        await lockMatch(tx, matchId)
        const existing = await findInningsOfMatch(tx, matchId)
        const first = existing[0]

        if (existing.length >= 2) throw new ConflictError(BOTH_INNINGS_STARTED)
        if (first && first.status !== "completed") throw new ConflictError(FIRST_INNINGS_NOT_OVER)

        const battingTeamId = first ? first.bowlingTeamId : firstBattingTeamId(match, tossWinnerTeamId)
        const bowlingTeamId = first ? first.battingTeamId : otherTeamId(match, battingTeamId)

        const batters = new Set(playingXi(players, battingTeamId).map((player) => player.id))
        if (!batters.has(input.strikerId) || !batters.has(input.nonStrikerId)) {
            throw new BadRequestError(OPENING_BATTER_NOT_IN_XI)
        }
        if (!playingXi(players, bowlingTeamId).some((player) => player.id === input.bowlerId)) {
            throw new BadRequestError(OPENING_BOWLER_NOT_IN_XI)
        }

        await insertInnings(tx, {
            matchId,
            inningsNumber: first ? 2 : 1,
            battingTeamId,
            bowlingTeamId,
            target: first ? first.runs + 1 : null,
            strikerId: input.strikerId,
            nonStrikerId: input.nonStrikerId,
            bowlerId: input.bowlerId,
        })
        await markScoringStarted(tx, matchId)
    })

    return getScoringState(matchId)
}

// --- Changing an innings ---------------------------------------------------------------------------------------

type StepInput = {
    match: Match
    players: Player[]
    row: InningsRow
    snapshot: InningsSnapshot
    rows: DeliveryRow[]
    records: DeliveryRecord[]
    allInnings: InningsRow[]
    rules: MatchRules
}

type StepOutput = {
    snapshot: InningsSnapshot
    // A delivery to store, and / or the id of the one to void
    insert?: NewDelivery
    voidId?: number
}

type Step = (input: StepInput) => RuleResult<StepOutput>

const asStep = <T>(result: RuleResult<T>, toOutput: (value: T) => StepOutput): RuleResult<StepOutput> =>
    result.ok ? ok(toOutput(result.value)) : result

// Runs one change of an innings as a single transaction: the innings row is locked, the screen's version must be
// the current one (a repeated or stale tap is rejected), the cricket rules are applied by the engine, the delivery
// is stored and the snapshot on the innings row is updated together with it.
const changeInnings = async (matchId: number, inningsNumber: number, expectedVersion: number, step: Step) => {
    const match = await assertScoringOpen(matchId)
    const rules = rulesOf(match)
    const players = await getMatchPlayers(matchId)

    await inTransaction(async (tx) => {
        const row = await lockInnings(tx, matchId, inningsNumber)
        if (!row) throw new NotFoundError(INNINGS_NOT_FOUND)
        // A finished match is final. Checked under the match lock, so a tap that races the deciding ball is rejected
        if ((await lockMatchState(tx, matchId))?.completedAt) throw new ConflictError(MATCH_OVER)
        if (row.version !== expectedVersion) throw new ConflictError(SCORE_CHANGED)

        const records = await findLiveDeliveries(tx, row.id)
        const allInnings = await findInningsOfMatch(tx, matchId)
        const result = step({
            match,
            players,
            row,
            snapshot: snapshotOf(row),
            rows: records.map(toEngineRow),
            records,
            allInnings,
            rules,
        })
        if (!result.ok) throw new BadRequestError(result.message)

        const { snapshot: next, insert, voidId } = result.value
        if (voidId !== undefined) await voidDelivery(tx, voidId)
        if (insert) {
            await insertDelivery(tx, { ...insert, inningsId: row.id, matchId, seq: (await findLastSeq(tx, row.id)) + 1 })
        }

        const finished = next.status === "completed"
        await updateInnings(tx, row.id, {
            runs: next.runs,
            wickets: next.wickets,
            legalBalls: next.legalBalls,
            strikerId: next.strikerId,
            nonStrikerId: next.nonStrikerId,
            bowlerId: next.bowlerId,
            status: next.status,
            endReason: next.endReason,
            completedAt: finished ? (row.completedAt ?? new Date()) : null,
            version: row.version + 1,
        })

        // The second innings decides the match and the result is final (nothing can be changed or undone afterwards)
        if (inningsNumber === 2) {
            const first = allInnings.find((innings) => innings.inningsNumber === 1)
            if (finished && first) {
                const result = computeResult({
                    first: { teamId: first.battingTeamId, name: teamOf(match, first.battingTeamId).name, runs: first.runs },
                    second: {
                        teamId: row.battingTeamId,
                        name: teamOf(match, row.battingTeamId).name,
                        runs: next.runs,
                        wickets: next.wickets,
                    },
                    playersPerSide: rules.playersPerSide,
                })
                await saveMatchResult(tx, matchId, {
                    resultType: result.resultType,
                    winnerTeamId: result.winnerTeamId,
                    resultSummary: result.summary,
                })
            }
        }
    })

    return getScoringState(matchId)
}

const toBallInput = (input: RecordBallInput): BallInput => ({
    runs: input.runs,
    isBoundary: input.isBoundary,
    overthrowRuns: input.overthrowRuns,
    extra: input.extra ? { type: input.extra.type, runKind: input.extra.runKind } : null,
    wicket: input.wicket
        ? {
              type: input.wicket.type,
              dismissedPlayerId: input.wicket.dismissedPlayerId ?? null,
              fielderId: input.wicket.fielderId ?? null,
          }
        : null,
})

// Record one ball
export const recordBall = (matchId: number, inningsNumber: number, input: RecordBallInput) =>
    changeInnings(matchId, inningsNumber, input.expectedVersion, ({ players, row, snapshot, rows, rules }) =>
        asStep(
            applyBall(snapshot, toBallInput(input), {
                ...rules,
                isFreeHit: isFreeHitNext(rows),
                // Anyone of the bowling team (substitutes too) can take a catch or make a run out
                fieldingPlayerIds: squadIds(players, row.bowlingTeamId),
            }),
            (outcome) => ({ snapshot: outcome.snapshot, insert: outcome.delivery }),
        ),
    )

// Put the chosen batter in the empty place after a wicket or a retirement
export const chooseBatter = (matchId: number, inningsNumber: number, input: ChooseBatterInput) =>
    changeInnings(matchId, inningsNumber, input.expectedVersion, ({ players, row, snapshot, rows }) =>
        asStep(
            selectBatter(snapshot, input.playerId, batterOptions(rows, playingXi(players, row.battingTeamId), snapshot)),
            (next) => ({ snapshot: next }),
        ),
    )

// Choose the bowler of the next over (or change it before the first ball of the over)
export const chooseBowler = (matchId: number, inningsNumber: number, input: ChooseBowlerInput) =>
    changeInnings(matchId, inningsNumber, input.expectedVersion, ({ players, row, snapshot, rows, rules }) => {
        const options = bowlerOptions(rows, playingXi(players, row.bowlingTeamId), snapshot.legalBalls, rules)
        const bowled = ballsBowledInOver(rows, currentOverOf(snapshot.legalBalls))
        return asStep(selectBowler(snapshot, input.playerId, options, bowled), (next) => ({ snapshot: next }))
    })

// The batters change ends (the scorer noticed they are at the wrong ends)
export const swapBatters = (matchId: number, inningsNumber: number, expectedVersion: number) =>
    changeInnings(matchId, inningsNumber, expectedVersion, ({ snapshot }) =>
        asStep(swapStrike(snapshot), (next) => ({ snapshot: next })),
    )

// A batter retires hurt (may come back) or retires out (counts as a wicket)
export const retireBatter = (matchId: number, inningsNumber: number, input: RetireInput) =>
    changeInnings(matchId, inningsNumber, input.expectedVersion, ({ snapshot, rules }) =>
        asStep(applyRetirement(snapshot, { playerId: input.playerId, type: input.type }, rules), (outcome) => ({
            snapshot: outcome.snapshot,
            insert: outcome.delivery,
        })),
    )

// Take back the last delivery (it stays stored, marked as voided)
export const undoLast = (matchId: number, inningsNumber: number, expectedVersion: number) =>
    changeInnings(matchId, inningsNumber, expectedVersion, ({ row, snapshot, rows, records, allInnings }) => {
        const last = rows[rows.length - 1]
        const record = records[records.length - 1]
        if (!last || !record) return fail(NOTHING_TO_UNDO)
        // Once the second innings has started the first one is settled
        if (row.inningsNumber === 1 && allInnings.length > 1) return fail(NEXT_INNINGS_STARTED)
        return ok({ snapshot: undoDelivery(snapshot, last), voidId: record.id })
    })

// The scorer ends the innings (for example the match is called off)
export const finishInnings = (matchId: number, inningsNumber: number, expectedVersion: number) =>
    changeInnings(matchId, inningsNumber, expectedVersion, ({ snapshot }) =>
        asStep(endInnings(snapshot), (next) => ({ snapshot: next })),
    )
