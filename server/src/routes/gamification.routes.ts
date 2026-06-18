import { Router }      from 'express'
import { authenticate } from '@/middlewares/auth.middleware'
import * as ctrl        from '@/controllers/gamification.controller'

const router = Router()

router.use(authenticate)

router.get('/', ctrl.getGamification)

export default router
