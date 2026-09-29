import { type Response } from "express"

export const success = (res: Response, data: unknown, statusCode = 200) => {
    return res.status(statusCode).json(data)
}

export const failure = (res: Response, message: string, statusCode = 400) => {
    return res.status(statusCode).json({ message })
}
