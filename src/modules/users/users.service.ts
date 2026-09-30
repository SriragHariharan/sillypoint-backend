import { db } from "../../db/postgres.js"
import { AppError, BadRequestError, ForbiddenError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage } from "../../shared/storage/cloudinary.js"
import { getMe } from "../auth/auth.service.js"
import {
    AVATAR_DELETE_FAILED,
    AVATAR_FOLDER,
    AVATAR_REQUIRED,
    AVATAR_SIZE_PX,
    USER_NOT_ACTIVE,
} from "./users.constants.js"
import { findUserForUpdate, setAvatar } from "./users.repository.js"

// Set or replace the profile photo. The new image is uploaded first; the old one is deleted after it is saved.
export const updateAvatar = async (userId: number, file?: Express.Multer.File) => {
    if (!file) throw new BadRequestError(AVATAR_REQUIRED)

    // Only a real, active user can have a photo (also stops uploads for blocked users)
    await getMe(userId)

    const uploaded = await uploadImage(file.buffer, AVATAR_FOLDER, { square: AVATAR_SIZE_PX })

    try {
        const previousPublicId = await db.transaction(async (tx) => {
            const user = await findUserForUpdate(tx, userId)
            if (!user || user.status !== "active") throw new ForbiddenError(USER_NOT_ACTIVE)

            await setAvatar(tx, userId, { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId })
            return user.avatarPublicId
        })

        // Best effort: a leftover old image is harmless, a failed request is not
        if (previousPublicId) await deleteImage(previousPublicId)

        return { avatar: uploaded.url }
    } catch (err) {
        // The photo was not saved, so do not leave the new image behind
        await deleteImage(uploaded.publicId)
        throw err
    }
}

// Remove the profile photo. It is deleted from Cloudinary first, so a failure keeps the photo and can be retried.
export const removeAvatar = async (userId: number) => {
    await db.transaction(async (tx) => {
        const user = await findUserForUpdate(tx, userId)
        if (!user || user.status !== "active") throw new ForbiddenError(USER_NOT_ACTIVE)

        // No photo: nothing to do
        if (!user.avatarPublicId) return

        if (!(await deleteImage(user.avatarPublicId))) throw new AppError(AVATAR_DELETE_FAILED, 502)

        await setAvatar(tx, userId, { avatarUrl: null, avatarPublicId: null })
    })

    return { avatar: null }
}
