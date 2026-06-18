import { Router } from 'express'
import * as c from '@/controllers/nutrition.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import {
  createFoodSchema,
  createMealSchema,
  addMealItemSchema,
  updateMealItemSchema,
} from '@/models/nutrition.model'

const router = Router()

router.use(authenticate)

router.get('/foods',              c.searchFoods)
router.post('/foods',             validate(createFoodSchema),     c.createFood)

router.get('/logs',               c.getLogHistory)
router.get('/logs/:date',         c.getLog)
router.post('/logs/:date/meals',  validate(createMealSchema),     c.createMeal)

router.delete('/meals/:mealId',                                   c.deleteMeal)
router.post('/meals/:mealId/items', validate(addMealItemSchema),  c.addMealItem)

router.put('/items/:itemId',     validate(updateMealItemSchema),  c.updateMealItem)
router.delete('/items/:itemId',                                   c.deleteMealItem)

export default router
