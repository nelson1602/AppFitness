import { Router }         from 'express'
import { authenticate }   from '@/middlewares/auth.middleware'
import { validate }       from '@/middlewares/validate.middleware'
import { HealthLogSchema } from '@/models/health.model'
import * as ctrl          from '@/controllers/health.controller'

const router = Router()

router.use(authenticate)

router.get('/today',   ctrl.getTodayHealth)
router.get('/history', ctrl.getHealthHistory)
router.post('/',  validate(HealthLogSchema), ctrl.logHealth)

export default router
