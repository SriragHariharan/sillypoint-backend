import express from "express"

const app = express()

app.get("/test", (_req, res) => {
    res.json({message: "Hello world, sillypoint"})
})

app.listen(3000, () => console.log("App running on port: http://localhost:3000/test"))