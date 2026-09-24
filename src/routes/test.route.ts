import { Router } from "express"
import { getTest } from "../handlers/test.handler.js"

const router = Router()

router.get("/test", getTest)

export default router
