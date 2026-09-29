import { z } from "zod"
import { otpPurposeEnum } from "../../db/schema/index.js"

// Signup body: mobile must be exactly 10 digits
export const signupSchema = z.object({
    mobile: z.string({ error: "Mobile is required" }).regex(/^[0-9]{10}$/, "Mobile must be 10 digits"),
})

// Verify body: user id, 4-digit OTP and what the OTP was for
export const verifyOtpSchema = z.object({
    userId: z.number({ error: "User id is required" }).int().positive(),
    otp: z.string({ error: "OTP is required" }).regex(/^[0-9]{4}$/, "OTP must be 4 digits"),
    purpose: z.enum(otpPurposeEnum.enumValues, { error: "Invalid purpose" }),
})

// Resend body: user id and what the OTP is for
export const resendOtpSchema = z.object({
    userId: z.number({ error: "User id is required" }).int().positive(),
    purpose: z.enum(otpPurposeEnum.enumValues, { error: "Invalid purpose" }),
})

export type SignupInput = z.infer<typeof signupSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResendOtpInput = z.infer<typeof resendOtpSchema>
