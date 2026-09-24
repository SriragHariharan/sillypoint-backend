import express, { type Request, type Response } from "express"

const app = express()

app.get("/test", (_req: Request, res: Response) => {
    res.json({message: "Hello world, sillypoint"})
})

app.listen(3000, () => console.log("App running on port: http://localhost:3000/test"))
