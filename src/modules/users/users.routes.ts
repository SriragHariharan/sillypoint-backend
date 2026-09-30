import { Router } from "express"
import { authenticate } from "../../shared/middleware/authenticate.js"
import { imageUpload } from "../../shared/middleware/upload.js"
import { removeAvatar, updateAvatar } from "./users.controller.js"
import { AVATAR_FIELD } from "./users.constants.js"

const router = Router()

// PUT /api/users/me/avatar: logged in users only; reads the image, then saves it as the profile photo
router.put("/me/avatar", authenticate, imageUpload(AVATAR_FIELD), updateAvatar)

// DELETE /api/users/me/avatar: logged in users only; removes the profile photo
router.delete("/me/avatar", authenticate, removeAvatar)

export default router
