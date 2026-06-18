import { Router }          from 'express'
import { authenticate }    from '@/middlewares/auth.middleware'
import { validate }        from '@/middlewares/validate.middleware'
import { ProfileSchema }   from '@/models/profile.model'
import * as ctrl           from '@/controllers/profile.controller'

const router = Router()

router.use(authenticate)

router.get('/',  ctrl.getProfile)
router.put('/',  validate(ProfileSchema), ctrl.upsertProfile)

export default router
