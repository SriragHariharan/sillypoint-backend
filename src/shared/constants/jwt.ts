export const JWT_ALGORITHM = "HS256"
export const JWT_ISSUER = "sillypoint"

// The audience tells access and refresh tokens apart, on top of using different secrets
export const ACCESS_TOKEN_AUDIENCE = "access"
export const REFRESH_TOKEN_AUDIENCE = "refresh"
// A scorer's token is signed with the access secret but has its own audience, so it never passes as a user access token
export const SCORER_TOKEN_AUDIENCE = "scorer"

export const UNAUTHORIZED = "Unauthorized"
export const ACCESS_TOKEN_EXPIRED = "Access token expired"
