import { Request, Response, NextFunction } from 'express'
import * as gamService from '@/services/gamification.service'

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

export const getGamification = wrap(async (req, res) => {
  const data = await gamService.getUserGamification(req.userId)
  res.json(data)
})
