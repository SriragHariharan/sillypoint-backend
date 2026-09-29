const MIN_SECRET_LENGTH = 32

const required = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} environment variable is not set`)
    return value
}

const secret = (name: string) => {
    const value = required(name)
    if (value.length < MIN_SECRET_LENGTH) {
        throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters`)
    }
    return value
}

const accessTokenSecret = secret("ACCESS_TOKEN_SECRET")
const refreshTokenSecret = secret("REFRESH_TOKEN_SECRET")

// A leaked secret for one token type must not work for the other
if (accessTokenSecret === refreshTokenSecret) {
    throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different")
}

export const env = {
    accessTokenSecret,
    refreshTokenSecret,
    clientOrigin: required("CLIENT_ORIGIN"),
    isProduction: process.env.NODE_ENV === "production",
    // Optional at startup: only image uploads need them
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
}
