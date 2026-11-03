import { type NextFunction, type Request, type Response } from "express"
import { AppError } from "../http/errors.js"
import { failure } from "../http/response.js"

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        return failure(res, err.message, err.statusCode)
    }

    // Drivers wrap the real reason (e.g. a database timeout) in err.cause
    const cause = err instanceof Error && err.cause instanceof Error ? ` | cause: ${err.cause.message}` : ""
    console.error("Unhandled error:", (err instanceof Error ? err.message : "unknown") + cause)
    return failure(res, "Internal server error", 500)
}
