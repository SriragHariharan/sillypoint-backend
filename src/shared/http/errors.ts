export class AppError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
    ) {
        super(message)
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(message, 400)
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super(message, 403)
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409)
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message: string) {
        super(message, 429)
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string) {
        super(message, 401)
    }
}
