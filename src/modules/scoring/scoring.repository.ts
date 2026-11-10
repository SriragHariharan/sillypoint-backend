import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { deliveries, innings, matches } from "../../db/schema/index.js"

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
// Either the plain connection or a transaction: both run the same queries
export type Executor = typeof db | Tx

export type InningsRow = typeof innings.$inferSelect
export type DeliveryRecord = typeof deliveries.$inferSelect
export type NewInnings = typeof innings.$inferInsert
export type NewDeliveryRecord = typeof deliveries.$inferInsert

// Run several queries as one all-or-nothing unit
export const inTransaction = <T>(work: (tx: Tx) => Promise<T>) => db.transaction(work)

// Serialise two requests that would both start an innings of the same match
export const lockMatch = async (tx: Tx, matchId: number) => {
    await tx.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1).for("update")
}

export const findInningsOfMatch = (executor: Executor, matchId: number) =>
    executor.select().from(innings).where(eq(innings.matchId, matchId)).orderBy(asc(innings.inningsNumber))

// One innings with its row locked until the transaction ends, so two taps cannot change it at the same time
export const lockInnings = async (tx: Tx, matchId: number, inningsNumber: number) => {
    const [row] = await tx
        .select()
        .from(innings)
        .where(and(eq(innings.matchId, matchId), eq(innings.inningsNumber, inningsNumber)))
        .limit(1)
        .for("update")
    return row
}

export const insertInnings = async (tx: Tx, values: NewInnings) => {
    const [row] = await tx.insert(innings).values(values).returning()
    return row
}

export const updateInnings = async (
    tx: Tx,
    id: number,
    values: Partial<Pick<NewInnings, "runs" | "wickets" | "legalBalls" | "strikerId" | "nonStrikerId" | "bowlerId" | "status" | "endReason" | "completedAt" | "version">>,
) => {
    await tx.update(innings).set(values).where(eq(innings.id, id))
}

// The deliveries of one innings that are still counted (not voided), in the order they were bowled
export const findLiveDeliveries = (executor: Executor, inningsId: number) =>
    executor
        .select()
        .from(deliveries)
        .where(and(eq(deliveries.inningsId, inningsId), isNull(deliveries.voidedAt)))
        .orderBy(asc(deliveries.seq))

// The deliveries of the whole match that are still counted, innings by innings
export const findLiveDeliveriesOfMatch = (executor: Executor, matchId: number) =>
    executor
        .select()
        .from(deliveries)
        .where(and(eq(deliveries.matchId, matchId), isNull(deliveries.voidedAt)))
        .orderBy(asc(deliveries.inningsId), asc(deliveries.seq))

// The highest seq ever used in the innings (voided deliveries keep theirs), so the next one is never a duplicate
export const findLastSeq = async (tx: Tx, inningsId: number) => {
    const [row] = await tx
        .select({ last: sql<number>`coalesce(max(${deliveries.seq}), 0)::int` })
        .from(deliveries)
        .where(eq(deliveries.inningsId, inningsId))
    return row?.last ?? 0
}

export const insertDelivery = async (tx: Tx, values: NewDeliveryRecord) => {
    await tx.insert(deliveries).values(values)
}

// Undo: the row stays as the audit trail
export const voidDelivery = async (tx: Tx, id: number) => {
    await tx.update(deliveries).set({ voidedAt: new Date() }).where(eq(deliveries.id, id))
}

// The first innings started: from now on the toss, overs and players are locked
export const markScoringStarted = async (tx: Tx, matchId: number) => {
    await tx
        .update(matches)
        .set({ scoringStartedAt: new Date() })
        .where(and(eq(matches.id, matchId), isNull(matches.scoringStartedAt)))
}

export const saveMatchResult = async (
    tx: Tx,
    matchId: number,
    result: { resultType: string; winnerTeamId: number | null; resultSummary: string },
) => {
    await tx
        .update(matches)
        .set({
            completedAt: new Date(),
            resultType: result.resultType,
            winnerTeamId: result.winnerTeamId,
            resultSummary: result.resultSummary,
        })
        .where(eq(matches.id, matchId))
}

// Undo of the ball that ended the match: the match is not over any more
export const clearMatchResult = async (tx: Tx, matchId: number) => {
    await tx
        .update(matches)
        .set({ completedAt: null, resultType: null, winnerTeamId: null, resultSummary: null })
        .where(eq(matches.id, matchId))
}
