import { z } from "zod"

// Signup body: mobile must be exactly 10 digits
export const signupSchema = z.object({
    mobile: z.string({ error: "Mobile is required" }).regex(/^[0-9]{10}$/, "Mobile must be 10 digits"),
})

export type SignupInput = z.infer<typeof signupSchema>
