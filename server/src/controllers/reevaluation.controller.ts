import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/reevaluation.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const getStatus = wrap(async (req, res) => {
  res.json(await svc.getReevaluationStatus(req.userId))
})

export const complete = wrap(async (req, res) => {
  res.json(await svc.completeReevaluation(req.userId))
})
