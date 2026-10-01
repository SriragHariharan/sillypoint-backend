import { db } from "../../db/postgres.js"
import { BadRequestError, NotFoundError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage, type UploadedImage } from "../../shared/storage/cloudinary.js"
import { getMe } from "../auth/auth.service.js"
import { LOGO_FOLDER, NOTHING_TO_UPDATE, TEAM_NOT_FOUND } from "./teams.constants.js"
import { findTeamByManager, findTeamForUpdate, insertTeam, listTeamsByManager, updateTeam } from "./teams.repository.js"
import { type CreateTeamInput, type UpdateTeamInput } from "./teams.schema.js"

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
            captainName: input.captain_name,
            captainMobile: input.captain_mobile,
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
                captainName: input.captain_name,
                captainMobile: input.captain_mobile,
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
