import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/progress.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const getProgressReport = wrap(async (req, res) => {
  res.json(await svc.getProgressReport(req.userId))
})
