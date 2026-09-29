import { type Request, type Response } from "express"
import { success } from "../../shared/http/response.js"
import { type SignupInput } from "./auth.schema.js"
import * as authService from "./auth.service.js"

// Handles the signup request
export const signup = async (req: Request, res: Response) => {
    // Body is already checked by the validate middleware
    const { mobile } = req.body as SignupInput
    await authService.signup(mobile)
    return success(res, { message: "OTP sent" }, 201)
}
