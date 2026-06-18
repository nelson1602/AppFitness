import { Router }      from 'express'
import { authenticate } from '@/middlewares/auth.middleware'
import * as ctrl        from '@/controllers/coach.controller'

const router = Router()

router.use(authenticate)

router.get('/report',            ctrl.getReport)
router.post('/apply-nutrition',  ctrl.applyNutrition)
router.post('/snapshot',         ctrl.saveSnapshot)

export default router
