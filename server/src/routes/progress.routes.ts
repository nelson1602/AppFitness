import { Router }  from 'express'
import * as c      from '@/controllers/progress.controller'
import { authenticate } from '@/middlewares/auth.middleware'

const router = Router()
router.use(authenticate)
router.get('/report', c.getProgressReport)

export default router
