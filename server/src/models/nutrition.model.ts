import { z } from 'zod'

export const createFoodSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  fiber: z.number().min(0).optional(),
})

export const createMealSchema = z.object({
  name: z.string().min(1).max(50),
})

export const addMealItemSchema = z.object({
  foodId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
})

export const updateMealItemSchema = z.object({
  quantity: z.number().positive('Quantity must be greater than 0'),
})

export type CreateFoodInput = z.infer<typeof createFoodSchema>
export type CreateMealInput = z.infer<typeof createMealSchema>
export type AddMealItemInput = z.infer<typeof addMealItemSchema>
export type UpdateMealItemInput = z.infer<typeof updateMealItemSchema>
