import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "../../db/postgres.js"
import { teams } from "../../db/schema/index.js"
import { type Tx } from "../users/users.repository.js"

// Columns sent to the client (never logo_public_id)
const teamColumns = {
    id: teams.id,
    name: teams.name,
    logo: teams.logoUrl,
    captain_name: teams.captainName,
    captain_mobile: teams.captainMobile,
    manager_id: teams.managerId,
    created_at: teams.createdAt,
    updated_at: teams.updatedAt,
}

// Save a new team
export const insertTeam = async (values: {
    name: string
    logoUrl: string | null
    logoPublicId: string | null
    captainName: string
    captainMobile: string
    managerId: number
}) => {
    const [row] = await db.insert(teams).values(values).returning(teamColumns)
    return row
}

// One team, only if this user manages it
export const findTeamByManager = async (id: number, managerId: number) => {
    const [row] = await db
        .select(teamColumns)
        .from(teams)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .limit(1)
    return row
}

// All teams managed by this user, newest first
export const listTeamsByManager = (managerId: number) =>
    db.select(teamColumns).from(teams).where(eq(teams.managerId, managerId)).orderBy(desc(teams.createdAt), desc(teams.id))

// Which of these teams this user manages
export const findManagedTeamIds = async (managerId: number, ids: number[]) => {
    const rows = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.managerId, managerId), inArray(teams.id, ids)))
    return rows.map((row) => row.id)
}

// Lock the team row (only if this user manages it) and get its current logo
export const findTeamForUpdate = async (tx: Tx, id: number, managerId: number) => {
    const [row] = await tx
        .select({ id: teams.id, logoPublicId: teams.logoPublicId })
        .from(teams)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .limit(1)
        .for("update")
    return row
}

// Update the allowed fields. manager_id is never part of the values.
export const updateTeam = async (
    tx: Tx,
    id: number,
    managerId: number,
    values: {
        name?: string
        captainName?: string
        captainMobile?: string
        logoUrl?: string
        logoPublicId?: string
    },
) => {
    const [row] = await tx
        .update(teams)
        .set(values)
        .where(and(eq(teams.id, id), eq(teams.managerId, managerId)))
        .returning(teamColumns)
    return row
}
