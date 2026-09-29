import { type NextFunction, type Request, type Response } from "express"
import { type ZodType } from "zod"
import { failure } from "../http/response.js"

export const validate = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
        return failure(res, result.error.issues[0]?.message ?? "Invalid request", 400)
    }

    req.body = result.data
    next()
}
