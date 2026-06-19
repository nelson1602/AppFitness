import { Router } from 'express'
import authRoutes             from './auth.routes'
import workoutRoutes          from './workout.routes'
import nutritionRoutes        from './nutrition.routes'
import dashboardRoutes        from './dashboard.routes'
import profileRoutes          from './profile.routes'
import healthRoutes           from './health.routes'
import coachRoutes            from './coach.routes'
import gamificationRoutes     from './gamification.routes'
import progressRoutes         from './progress.routes'
import notificationRoutes     from './notification.routes'
import recommendationRoutes   from './recommendation.routes'
import reevaluationRoutes     from './reevaluation.routes'
import measurementRoutes      from './measurement.routes'
import supplementRoutes      from './supplement.routes'

const router = Router()

router.use('/auth',            authRoutes)
router.use('/workouts',        workoutRoutes)
router.use('/nutrition',       nutritionRoutes)
router.use('/dashboard',       dashboardRoutes)
router.use('/profile',         profileRoutes)
router.use('/health',          healthRoutes)
router.use('/coach',           coachRoutes)
router.use('/gamification',    gamificationRoutes)
router.use('/progress',        progressRoutes)
router.use('/notifications',   notificationRoutes)
router.use('/recommendations', recommendationRoutes)
router.use('/reevaluation',   reevaluationRoutes)
router.use('/measurements',  measurementRoutes)
router.use('/supplements',   supplementRoutes)

export default router
