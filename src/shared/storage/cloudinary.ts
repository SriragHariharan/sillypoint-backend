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

// Upload an image from memory. Cloudinary itself rejects files that are not real png/jpg/webp images.
export const uploadImage = async (buffer: Buffer, folder: string): Promise<UploadedImage> => {
    configure()

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image", allowed_formats: IMAGE_FORMATS },
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

// Best effort: a failed cleanup must never break the request
export const deleteImage = async (publicId: string) => {
    try {
        configure()
        await cloudinary.uploader.destroy(publicId)
    } catch (err) {
        console.error("Image cleanup failed:", err instanceof Error ? err.message : "unknown")
    }
}
