import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as svc from '@/services/dashboard.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const getSummary = wrap(async (req, res) => {
  res.json(await svc.getSummary(req.userId))
})

export const getWeightHistory = wrap(async (req, res) => {
  const weeks = Number(req.query.weeks) || 12
  res.json(await svc.getWeightHistory(req.userId, weeks))
})

export const getWeeklyVolume = wrap(async (req, res) => {
  const weeks = Number(req.query.weeks) || 8
  res.json(await svc.getWeeklyVolume(req.userId, weeks))
})

export const getNutritionWeek = wrap(async (req, res) => {
  res.json(await svc.getNutritionWeek(req.userId))
})

const logWeightSchema = z.object({
  weight: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(200).optional(),
})

export const logBodyWeight = wrap(async (req, res) => {
  const body = logWeightSchema.safeParse(req.body)
  if (!body.success) { res.status(400).json({ error: 'Invalid data' }); return }
  res.status(201).json(await svc.logBodyWeight(req.userId, body.data.weight, body.data.date, body.data.notes))
})

export const deleteBodyWeight = wrap(async (req, res) => {
  await svc.deleteBodyWeight(req.userId, req.params.id)
  res.status(204).send()
})
