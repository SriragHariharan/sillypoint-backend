import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import * as userService from "./users.service.js"

// Set or replace the logged in user's profile photo
export const updateAvatar = async (req: Request, res: Response) => {
    const { avatar } = await userService.updateAvatar(res.locals.userId as number, req.file)
    return success(res, { message: "Profile photo updated", avatar })
}

// Remove the logged in user's profile photo
export const removeAvatar = async (_req: Request, res: Response) => {
    const { avatar } = await userService.removeAvatar(res.locals.userId as number)
    return success(res, { message: "Profile photo removed", avatar })
}
