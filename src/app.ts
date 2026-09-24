import "dotenv/config"
import express, { type Request, type Response } from "express"
import { sql } from "drizzle-orm"
import { db } from "./db/postgres.js"

const app = express()

app.get("/test", (_req: Request, res: Response) => {
    res.json({message: "Hello world, sillypoint"})
})

async function start() {
    await db.execute(sql`select 1`)
    console.log("Connected to database")

    app.listen(3000, () => console.log("App running on port: http://localhost:3000/test"))
}

start().catch((err) => {
    console.error("Failed to start server:", err)
    process.exit(1)
})
