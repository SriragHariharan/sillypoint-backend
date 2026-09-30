import { v2 as cloudinary } from "cloudinary"
import { env } from "../config/env.js"
import {
    IMAGE_FORMATS,
    IMAGE_UPLOAD_FAILED,
    IMAGE_UPLOAD_INVALID,
    IMAGE_UPLOAD_NOT_CONFIGURED,
} from "../constants/upload.js"
import { AppError, BadRequestError } from "../http/errors.js"

export type UploadedImage = { url: string; publicId: string }

// Set the keys on first use, so the server can start before they are added to .env
const configure = () => {
    const { cloudName, apiKey, apiSecret } = env.cloudinary
    if (!cloudName || !apiKey || !apiSecret) throw new AppError(IMAGE_UPLOAD_NOT_CONFIGURED, 500)
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true })
}

type UploadOptions = { square?: number }

// Upload an image from memory. Cloudinary itself rejects files that are not real png/jpg/webp images.
// With `square`, the stored image is cropped to that size around the main subject (used for profile photos).
export const uploadImage = async (
    buffer: Buffer,
    folder: string,
    { square }: UploadOptions = {},
): Promise<UploadedImage> => {
    configure()

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
                allowed_formats: IMAGE_FORMATS,
                ...(square && { transformation: [{ width: square, height: square, crop: "fill", gravity: "auto" }] }),
            },
            (error, result) => {
                if (result) return resolve({ url: result.secure_url, publicId: result.public_id })
                // A file Cloudinary refuses is the user's mistake; anything else is ours
                const invalid = typeof error?.http_code === "number" && error.http_code === 400
                reject(invalid ? new BadRequestError(IMAGE_UPLOAD_INVALID) : new AppError(IMAGE_UPLOAD_FAILED, 502))
            },
        )
        stream.end(buffer)
    })
}

// Delete an image. Returns false instead of throwing, so the caller decides how much a failure matters.
// An image that is already gone counts as deleted.
export const deleteImage = async (publicId: string) => {
    try {
        configure()
        const { result } = await cloudinary.uploader.destroy(publicId, { invalidate: true })
        return result === "ok" || result === "not found"
    } catch (err) {
        console.error("Image delete failed:", err instanceof Error ? err.message : "unknown")
        return false
    }
}
