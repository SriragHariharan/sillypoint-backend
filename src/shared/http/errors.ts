export class AppError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
    ) {
        super(message)
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409)
    }
}
