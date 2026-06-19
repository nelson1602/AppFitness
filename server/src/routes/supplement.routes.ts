import { Router } from 'express'
import { authenticate } from '@/middlewares/auth.middleware'
import * as c from '@/controllers/supplement.controller'

const router = Router()

router.use(authenticate)

router.get('/', c.getSupplements)

export default router
