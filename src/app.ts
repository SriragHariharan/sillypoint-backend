import "dotenv/config"
import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import { sql } from "drizzle-orm"
import { db } from "./db/postgres.js"
import routes from "./routes.js"
import { env } from "./shared/config/env.js"
import { errorHandler } from "./shared/middleware/error-handler.js"

const app = express()

// Do not tell attackers which framework we use
app.disable("x-powered-by")

// Only our frontend may call the API from a browser; credentials are needed for the refresh cookie
app.use(
    cors({
        origin: env.clientOrigin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
)
app.use(express.json())
app.use(cookieParser())
app.use(routes)
app.use(errorHandler)

async function start() {
    await db.execute(sql`select 1`)
    console.log("Connected to database")

    app.listen(3000, () => console.log("App running on port: http://localhost:3000/test"))
}

start().catch((err) => {
    console.error("Failed to start server:", err)
    process.exit(1)
})
