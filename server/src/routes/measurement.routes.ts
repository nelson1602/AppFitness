import { Router } from 'express'
import * as c from '@/controllers/measurement.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate }     from '@/middlewares/validate.middleware'
import { saveMeasurementSchema } from '@/models/measurement.model'

const router = Router()
router.use(authenticate)

router.post('/',       validate(saveMeasurementSchema), c.save)
router.get('/',        c.list)
router.get('/latest',  c.latest)

export default router
