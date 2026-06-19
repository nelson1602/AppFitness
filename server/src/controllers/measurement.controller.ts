import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/measurement.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const save = wrap(async (req, res) => {
  res.json(await svc.saveMeasurement(req.userId, req.body))
})

export const list = wrap(async (req, res) => {
  const limit = Number(req.query.limit) || 30
  res.json(await svc.getMeasurements(req.userId, limit))
})

export const latest = wrap(async (req, res) => {
  res.json(await svc.getLatestMeasurement(req.userId))
})
