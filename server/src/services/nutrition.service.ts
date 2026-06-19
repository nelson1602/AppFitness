import { prisma } from '@/config/prisma'
import { AppError } from '@/utils/errors'
import type {
  CreateFoodInput,
  CreateMealInput,
  AddMealItemInput,
  UpdateMealItemInput,
} from '@/models/nutrition.model'

const FOOD_SELECT = {
  id: true, name: true, brand: true,
  calories: true, protein: true, carbs: true, fat: true, fiber: true,
} as const

const MEAL_INCLUDE = {
  items: {
    include: { food: { select: FOOD_SELECT } },
    orderBy: { id: 'asc' as const },
  },
} as const

const LOG_INCLUDE = {
  meals: {
    include: MEAL_INCLUDE,
    orderBy: { order: 'asc' as const },
  },
} as const

// ─── Foods ────────────────────────────────────────────────────────────────────

export const searchFoods = (search?: string, limit = 30) =>
  prisma.food.findMany({
    where: search ? { name: { contains: search } } : undefined,
    select: FOOD_SELECT,
    orderBy: { name: 'asc' },
    take: limit,
  })

export const createFood = (data: CreateFoodInput) =>
  prisma.food.create({ data, select: FOOD_SELECT })

// ─── Logs ─────────────────────────────────────────────────────────────────────

export const getLog = (userId: string, date: string) =>
  prisma.nutritionLog.findUnique({
    where: { userId_date: { userId, date } },
    include: LOG_INCLUDE,
  })

export const getLogHistory = (userId: string, limit = 10, offset = 0) =>
  prisma.nutritionLog.findMany({
    where: { userId },
    include: LOG_INCLUDE,
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
  })

// ─── Meals ────────────────────────────────────────────────────────────────────

export const createMeal = async (userId: string, date: string, data: CreateMealInput) => {
  const log = await prisma.nutritionLog.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date },
    include: { meals: { select: { id: true } } },
  })

  return prisma.meal.create({
    data: { ...data, order: log.meals.length, nutritionLogId: log.id },
    include: MEAL_INCLUDE,
  })
}

export const deleteMeal = async (userId: string, mealId: string) => {
  await assertMealOwner(userId, mealId)
  await prisma.meal.delete({ where: { id: mealId } })
}

// ─── Items ────────────────────────────────────────────────────────────────────

export const addMealItem = async (userId: string, mealId: string, data: AddMealItemInput) => {
  await assertMealOwner(userId, mealId)
  const food = await prisma.food.findUnique({ where: { id: data.foodId }, select: { id: true } })
  if (!food) throw new AppError('Food not found', 404)
  const item = await prisma.mealItem.create({
    data: { ...data, mealId },
    include: { food: { select: FOOD_SELECT } },
  })
  await prisma.userStats.upsert({
    where:  { userId },
    update: { mealsLogged: { increment: 1 } },
    create: { userId, mealsLogged: 1 },
  })
  return item
}

export const getTargets = async (userId: string) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { targetCalories: true, targetProteinG: true, targetCarbsG: true, targetFatG: true },
  })
  return {
    targetCalories: profile?.targetCalories ?? null,
    targetProteinG: profile?.targetProteinG ?? null,
    targetCarbsG:   profile?.targetCarbsG   ?? null,
    targetFatG:     profile?.targetFatG     ?? null,
  }
}

export const updateMealItem = async (userId: string, itemId: string, data: UpdateMealItemInput) => {
  await assertItemOwner(userId, itemId)
  return prisma.mealItem.update({
    where: { id: itemId },
    data,
    include: { food: { select: FOOD_SELECT } },
  })
}

export const deleteMealItem = async (userId: string, itemId: string) => {
  await assertItemOwner(userId, itemId)
  await prisma.mealItem.delete({ where: { id: itemId } })
}

// ─── Guards ───────────────────────────────────────────────────────────────────

const assertMealOwner = async (userId: string, mealId: string) => {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId },
    include: { nutritionLog: { select: { userId: true } } },
  })
  if (!meal || meal.nutritionLog.userId !== userId) throw new AppError('Meal not found', 404)
}

const assertItemOwner = async (userId: string, itemId: string) => {
  const item = await prisma.mealItem.findFirst({
    where: { id: itemId },
    include: { meal: { include: { nutritionLog: { select: { userId: true } } } } },
  })
  if (!item || item.meal.nutritionLog.userId !== userId) throw new AppError('Item not found', 404)
}
