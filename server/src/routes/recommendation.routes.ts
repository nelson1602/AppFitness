import { Router }  from 'express'
import * as c      from '@/controllers/supplement.controller'
import { authenticate } from '@/middlewares/auth.middleware'

const router = Router()
router.use(authenticate)
router.get('/supplements', c.getSupplements)

export default router
