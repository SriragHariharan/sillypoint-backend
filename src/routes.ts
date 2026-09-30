import { Router } from "express"
import authRoutes from "./modules/auth/auth.routes.js"
import healthRoutes from "./modules/health/health.routes.js"
import tournamentRoutes from "./modules/tournaments/tournaments.routes.js"
import userRoutes from "./modules/users/users.routes.js"

const router = Router()

router.use(healthRoutes)
router.use("/api/auth", authRoutes)
router.use("/api/tournaments", tournamentRoutes)
router.use("/api/users", userRoutes)

export default router
