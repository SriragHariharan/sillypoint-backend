import { type NextFunction, type Request, type Response } from "express"
import multer, { MulterError } from "multer"
import {
    IMAGE_MAX_BYTES,
    IMAGE_MIME_TYPES,
    IMAGE_TOO_LARGE,
    IMAGE_TYPE_INVALID,
    IMAGE_UPLOAD_INVALID,
} from "../constants/upload.js"
import { failure } from "../http/response.js"

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, callback) => {
        if (IMAGE_MIME_TYPES.includes(file.mimetype)) return callback(null, true)
        callback(new MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname))
    },
})

// Reads one optional image from the multipart field, and turns upload errors into a 400
export const imageUpload = (field: string) => {
    const single = upload.single(field)

    return (req: Request, res: Response, next: NextFunction) => {
        single(req, res, (err: unknown) => {
            if (!err) return next()
            if (err instanceof MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") return failure(res, IMAGE_TOO_LARGE, 400)
                if (err.field === field) return failure(res, IMAGE_TYPE_INVALID, 400)
            }
            return failure(res, IMAGE_UPLOAD_INVALID, 400)
        })
    }
}
