import { type Request, type Response } from "express"
import { success } from "../helpers/response.js"

export const getTest = (_req: Request, res: Response) => {
    return success(res, { message: "Hello world, sillypoint" })
}
