import api from '@/lib/axios'
import type { Food, Meal, MealItem, NutritionLog, MacroTargets } from '@/types/nutrition'

export const searchFoods = (search?: string) =>
  api.get<Food[]>('/nutrition/foods', { params: { search } }).then((r) => r.data)

export const createFood = (data: Omit<Food, 'id'>) =>
  api.post<Food>('/nutrition/foods', data).then((r) => r.data)

export const fetchLog = (date: string) =>
  api.get<NutritionLog>(`/nutrition/logs/${date}`).then((r) => r.data)

export const fetchLogHistory = (params?: { limit?: number; offset?: number }) =>
  api.get<NutritionLog[]>('/nutrition/logs', { params }).then((r) => r.data)

export const createMeal = (date: string, name: string) =>
  api.post<Meal>(`/nutrition/logs/${date}/meals`, { name }).then((r) => r.data)

export const deleteMeal = (mealId: string) =>
  api.delete(`/nutrition/meals/${mealId}`)

export const addMealItem = (mealId: string, data: { foodId: string; quantity: number }) =>
  api.post<MealItem>(`/nutrition/meals/${mealId}/items`, data).then((r) => r.data)

export const updateMealItem = (itemId: string, quantity: number) =>
  api.put<MealItem>(`/nutrition/items/${itemId}`, { quantity }).then((r) => r.data)

export const deleteMealItem = (itemId: string) =>
  api.delete(`/nutrition/items/${itemId}`)

export const fetchTargets = () =>
  api.get<MacroTargets>('/nutrition/targets').then((r) => r.data)
