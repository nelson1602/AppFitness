import { Router } from 'express'
import authRoutes from './auth.routes'
import workoutRoutes from './workout.routes'
import nutritionRoutes from './nutrition.routes'
import dashboardRoutes from './dashboard.routes'

const router = Router()

router.use('/auth',      authRoutes)
router.use('/workouts',  workoutRoutes)
router.use('/nutrition', nutritionRoutes)
router.use('/dashboard', dashboardRoutes)

export default router
