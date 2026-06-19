import { Router } from 'express'
import * as c from '@/controllers/reevaluation.controller'
import { authenticate } from '@/middlewares/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/status',   c.getStatus)
router.post('/complete', c.complete)

export default router
