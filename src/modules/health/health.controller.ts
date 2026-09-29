import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"

export const getHealth = (_req: Request, res: Response) => {
    return success(res, { message: "Hello world, sillypoint" })
}
