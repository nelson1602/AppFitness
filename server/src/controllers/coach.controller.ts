import { Request, Response, NextFunction } from 'express'
import * as coachService from '@/services/coach.service'

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

export const getReport = wrap(async (req, res) => {
  const report = await coachService.generateCoachReport(req.userId)
  res.json(report)
})

export const applyNutrition = wrap(async (req, res) => {
  await coachService.applyNutritionTargets(req.userId)
  res.json({ message: 'Nutrition targets updated' })
})

export const saveSnapshot = wrap(async (req, res) => {
  await coachService.saveWeeklySnapshot(req.userId)
  res.json({ message: 'Weekly snapshot saved' })
})
