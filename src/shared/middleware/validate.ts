import { type NextFunction, type Request, type Response } from "express"
import { type ZodType } from "zod"
import { failure } from "../http/response.js"

type Source = "body" | "params" | "query"

// Checks the request part with a zod schema. The body is replaced by the parsed value.
// Params and query go to res.locals.params / res.locals.query (req.query is read-only in Express 5).
export const validate =
    (schema: ZodType, source: Source = "body") =>
    (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source])

        if (!result.success) {
            return failure(res, result.error.issues[0]?.message ?? "Invalid request", 400)
        }

        if (source === "body") req.body = result.data
        else res.locals[source] = result.data

        next()
    }
