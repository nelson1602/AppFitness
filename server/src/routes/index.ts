import { Router } from 'express'
import authRoutes         from './auth.routes'
import workoutRoutes      from './workout.routes'
import nutritionRoutes    from './nutrition.routes'
import dashboardRoutes    from './dashboard.routes'
import profileRoutes      from './profile.routes'
import healthRoutes       from './health.routes'
import coachRoutes        from './coach.routes'
import gamificationRoutes from './gamification.routes'

const router = Router()

router.use('/auth',          authRoutes)
router.use('/workouts',      workoutRoutes)
router.use('/nutrition',     nutritionRoutes)
router.use('/dashboard',     dashboardRoutes)
router.use('/profile',       profileRoutes)
router.use('/health',        healthRoutes)
router.use('/coach',         coachRoutes)
router.use('/gamification',  gamificationRoutes)

export default router
