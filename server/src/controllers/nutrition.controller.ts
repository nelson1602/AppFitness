import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/nutrition.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const searchFoods = wrap(async (req, res) => {
  res.json(await svc.searchFoods(req.query.search as string | undefined))
})

export const createFood = wrap(async (req, res) => {
  res.status(201).json(await svc.createFood(req.body))
})

export const getLog = wrap(async (req, res) => {
  const log = await svc.getLog(req.userId, req.params.date)
  if (!log) { res.status(404).json({ error: 'No log for this date' }); return }
  res.json(log)
})

export const getLogHistory = wrap(async (req, res) => {
  const limit = Number(req.query.limit) || 10
  const offset = Number(req.query.offset) || 0
  res.json(await svc.getLogHistory(req.userId, limit, offset))
})

export const createMeal = wrap(async (req, res) => {
  res.status(201).json(await svc.createMeal(req.userId, req.params.date, req.body))
})

export const deleteMeal = wrap(async (req, res) => {
  await svc.deleteMeal(req.userId, req.params.mealId)
  res.status(204).send()
})

export const addMealItem = wrap(async (req, res) => {
  res.status(201).json(await svc.addMealItem(req.userId, req.params.mealId, req.body))
})

export const updateMealItem = wrap(async (req, res) => {
  res.json(await svc.updateMealItem(req.userId, req.params.itemId, req.body))
})

export const deleteMealItem = wrap(async (req, res) => {
  await svc.deleteMealItem(req.userId, req.params.itemId)
  res.status(204).send()
})

export const getTargets = wrap(async (req, res) => {
  res.json(await svc.getTargets(req.userId))
})
