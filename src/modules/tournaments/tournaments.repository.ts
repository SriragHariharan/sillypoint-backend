import { and, count, desc, eq, gt, gte, ilike, isNotNull, isNull, lt, lte, or, type SQL } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { tournaments, users } from "../../db/schema/index.js"
import { type ListTournamentsQuery } from "./tournaments.schema.js"

// Columns sent to the client (never logo_public_id)
const summaryColumns = {
    id: tournaments.id,
    organizerId: tournaments.organizerId,
    name: tournaments.name,
    logo: tournaments.logoUrl,
    location: tournaments.location,
    startDate: tournaments.startDate,
    endDate: tournaments.endDate,
    cancelledAt: tournaments.cancelledAt,
    createdAt: tournaments.createdAt,
}

export type TournamentSummaryRow = NonNullable<Awaited<ReturnType<typeof insertTournament>>>

// Make user text safe for LIKE: % _ and \ must match themselves
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&")

// The status filter, worked out from the dates. `today` is a YYYY-MM-DD string in the tournament time zone.
const statusCondition = (status: NonNullable<ListTournamentsQuery["status"]>, today: string) => {
    switch (status) {
        case "cancelled":
            return isNotNull(tournaments.cancelledAt)
        case "upcoming":
            return and(isNull(tournaments.cancelledAt), gt(tournaments.startDate, today))
        case "live":
            return and(isNull(tournaments.cancelledAt), lte(tournaments.startDate, today), gte(tournaments.endDate, today))
        case "completed":
            return and(isNull(tournaments.cancelledAt), lt(tournaments.endDate, today))
    }
}

// Save a new tournament
export const insertTournament = async (values: {
    organizerId: number
    name: string
    description: string
    logoUrl: string | null
    logoPublicId: string | null
    location: string
    startDate: string
    endDate: string
}) => {
    const [row] = await db.insert(tournaments).values(values).returning(summaryColumns)
    return row
}

// The few columns needed to check who owns a tournament and what state it is in
export const findTournamentForCancel = async (id: number) => {
    const [row] = await db
        .select({
            id: tournaments.id,
            organizerId: tournaments.organizerId,
            endDate: tournaments.endDate,
            cancelledAt: tournaments.cancelledAt,
        })
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .limit(1)
    return row
}

// Cancel a tournament that is not cancelled yet. Returns nothing if someone else cancelled it first.
export const markCancelled = async (id: number) => {
    const [row] = await db
        .update(tournaments)
        .set({ cancelledAt: new Date() })
        .where(and(eq(tournaments.id, id), isNull(tournaments.cancelledAt)))
        .returning(summaryColumns)
    return row
}

// One tournament with its organizer, or nothing
export const findTournamentDetails = async (id: number) => {
    const [row] = await db
        .select({
            ...summaryColumns,
            description: tournaments.description,
            organizer: { id: users.id, mobile: users.mobile, avatar: users.avatarUrl },
        })
        .from(tournaments)
        .innerJoin(users, eq(users.id, tournaments.organizerId))
        .where(eq(tournaments.id, id))
        .limit(1)
    return row
}

// A page of tournaments that match the filters, and how many match in total
export const listTournaments = async (query: ListTournamentsQuery, today: string) => {
    const conditions: (SQL | undefined)[] = []

    if (query.q) {
        const pattern = `%${escapeLike(query.q)}%`
        conditions.push(or(ilike(tournaments.name, pattern), ilike(tournaments.location, pattern)))
    }
    if (query.status) conditions.push(statusCondition(query.status, today))
    if (query.startFrom) conditions.push(gte(tournaments.startDate, query.startFrom))
    if (query.startTo) conditions.push(lte(tournaments.startDate, query.startTo))
    if (query.organizerId) conditions.push(eq(tournaments.organizerId, query.organizerId))

    const where = and(...conditions)

    const [rows, totals] = await Promise.all([
        db
            .select(summaryColumns)
            .from(tournaments)
            .where(where)
            .orderBy(desc(tournaments.startDate), desc(tournaments.id))
            .limit(query.limit)
            .offset((query.page - 1) * query.limit),
        db.select({ total: count() }).from(tournaments).where(where),
    ])

    return { rows, total: totals[0]?.total ?? 0 }
}
