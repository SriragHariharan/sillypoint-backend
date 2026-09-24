import { Router } from "express"
import testRoute from "./test.route.js"

const router = Router()

router.use(testRoute)

export default router
