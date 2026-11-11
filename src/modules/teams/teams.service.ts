import { db } from "../../db/postgres.js"
import { oversText } from "../../engines/scoring/delivery-math.js"
import { BALLS_PER_OVER } from "../../shared/constants/scoring.js"
import { BadRequestError, NotFoundError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage, type UploadedImage } from "../../shared/storage/cloudinary.js"
import { getMe } from "../auth/auth.service.js"
import { LOGO_FOLDER, NOTHING_TO_UPDATE, TEAM_NOT_FOUND } from "./teams.constants.js"
import {
    findManagedTeamIds,
    findTeamByManager,
    findTeamForUpdate,
    insertTeam,
    listTeamMatches,
    listTeamsByManager,
    summariseTeamMatches,
    updateTeam,
} from "./teams.repository.js"
import { type CreateTeamInput, type TeamMatchesQuery, type UpdateTeamInput } from "./teams.schema.js"

// Create a team. The manager is the logged in user, so only a real, active user can manage a team.
export const createTeam = async (managerId: number, input: CreateTeamInput, logoFile?: Express.Multer.File) => {
    await getMe(managerId)

    let logo: UploadedImage | undefined
    if (logoFile) logo = await uploadImage(logoFile.buffer, LOGO_FOLDER)

    try {
        const row = await insertTeam({
            name: input.name,
            logoUrl: logo?.url ?? null,
            logoPublicId: logo?.publicId ?? null,
            managerName: input.manager_name,
            managerMobile: input.manager_mobile,
            managerId,
        })
        if (!row) throw new Error("Failed to create team")
        return row
    } catch (err) {
        // The row was not saved, so do not leave the image behind
        if (logo) await deleteImage(logo.publicId)
        throw err
    }
}

// Every team the user manages
export const listMyTeams = async (managerId: number) => listTeamsByManager(managerId)

// One team, only if the user manages it. Someone else's team looks the same as a missing one.
export const getMyTeam = async (managerId: number, id: number) => {
    const row = await findTeamByManager(id, managerId)
    if (!row) throw new NotFoundError(TEAM_NOT_FOUND)
    return row
}

// Make sure every id is a team the user manages. Someone else's team looks the same as a missing one.
export const assertManagesTeams = async (managerId: number, ids: number[]) => {
    const owned = await findManagedTeamIds(managerId, ids)
    if (owned.length !== ids.length) throw new NotFoundError(TEAM_NOT_FOUND)
}

// Update a team the user manages. A new logo is uploaded first; the old one is deleted after the save.
export const updateMyTeam = async (managerId: number, id: number, input: UpdateTeamInput, logoFile?: Express.Multer.File) => {
    const hasFields = Object.values(input).some((value) => value !== undefined)
    if (!hasFields && !logoFile) throw new BadRequestError(NOTHING_TO_UPDATE)

    await getMe(managerId)

    let logo: UploadedImage | undefined
    if (logoFile) logo = await uploadImage(logoFile.buffer, LOGO_FOLDER)

    try {
        const { team, previousPublicId } = await db.transaction(async (tx) => {
            const existing = await findTeamForUpdate(tx, id, managerId)
            if (!existing) throw new NotFoundError(TEAM_NOT_FOUND)

            const team = await updateTeam(tx, id, managerId, {
                name: input.name,
                managerName: input.manager_name,
                managerMobile: input.manager_mobile,
                ...(logo ? { logoUrl: logo.url, logoPublicId: logo.publicId } : {}),
            })
            if (!team) throw new NotFoundError(TEAM_NOT_FOUND)

            return { team, previousPublicId: existing.logoPublicId }
        })

        // Best effort: a leftover old image is harmless, a failed request is not
        if (logo && previousPublicId) await deleteImage(previousPublicId)

        return team
    } catch (err) {
        // The change was not saved, so do not leave the new image behind
        if (logo) await deleteImage(logo.publicId)
        throw err
    }
}

type HistoryRow = Awaited<ReturnType<typeof listTeamMatches>>["rows"][number]

// A side's score once it has batted, otherwise nothing
const scoreOf = (runs: number | null, wickets: number | null, balls: number | null) =>
    runs === null || wickets === null || balls === null ? null : { runs, wickets, overs: oversText(balls, BALLS_PER_OVER) }

// Where the match stands: finished, being scored, or not started
const stateOf = (row: HistoryRow) => {
    if (row.completedAt) return "completed"
    return row.scoringStartedAt ? "live" : "upcoming"
}

// How the match went for this team
const resultFor = (row: HistoryRow, teamId: number) => {
    if (row.resultType === "tie") return "tied"
    if (row.resultType === "win") return row.winnerTeamId === teamId ? "won" : "lost"
    return null
}

// The matches one of the manager's teams plays in, newest first, with each side's score and a summary of all of them
export const listTeamHistory = async (managerId: number, teamId: number, query: TeamMatchesQuery) => {
    await getMyTeam(managerId, teamId)

    const [{ rows, total }, summary] = await Promise.all([listTeamMatches(teamId, query), summariseTeamMatches(teamId)])

    return {
        summary,
        matches: rows.map((row) => ({
            id: row.id,
            scheduledAt: row.scheduledAt,
            stage: row.stage,
            state: stateOf(row),
            result: resultFor(row, teamId),
            resultSummary: row.resultSummary,
            tournament: { id: row.tournament.id, name: row.tournament.name },
            teamA: { ...row.teamA, score: scoreOf(row.runsA, row.wicketsA, row.ballsA) },
            teamB: { ...row.teamB, score: scoreOf(row.runsB, row.wicketsB, row.ballsB) },
        })),
        page: query.page,
        limit: query.limit,
        total,
    }
}
