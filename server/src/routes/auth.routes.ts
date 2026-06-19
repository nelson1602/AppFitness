import { Router } from 'express'
import * as authController from '@/controllers/auth.controller'
import { validate } from '@/middlewares/validate.middleware'
import { authenticate } from '@/middlewares/auth.middleware'
import { authLimiter } from '@/middlewares/rateLimiter'
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema, updateAccountSchema } from '@/models/auth.model'

const router = Router()

router.post('/register',        authLimiter,  validate(registerSchema),        authController.register)
router.post('/login',           authLimiter,  validate(loginSchema),            authController.login)
router.post('/refresh',         authLimiter,  validate(refreshSchema),          authController.refresh)
router.post('/logout',                        validate(refreshSchema),           authController.logout)
router.get('/me',               authenticate,                                   authController.me)
router.post('/change-password', authenticate, validate(changePasswordSchema),   authController.changePassword)
router.patch('/account',        authenticate, validate(updateAccountSchema),    authController.updateAccount)

export default router
