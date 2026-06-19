import { Router } from 'express'
import * as c from '@/controllers/dashboard.controller'
import { authenticate } from '@/middlewares/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/summary',         c.getSummary)
router.get('/coach-insight',   c.getCoachInsight)
router.get('/weight-history',  c.getWeightHistory)
router.get('/weekly-volume',   c.getWeeklyVolume)
router.get('/nutrition-week',  c.getNutritionWeek)

router.post('/bodyweight',     c.logBodyWeight)
router.delete('/bodyweight/:id', c.deleteBodyWeight)

export default router
