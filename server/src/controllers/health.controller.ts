import { Request, Response, NextFunction } from 'express'
import * as healthService from '@/services/health.service'
import { HealthEngine }   from '@/engines/health/health.engine'

const engine = new HealthEngine()

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

export const logHealth = wrap(async (req, res) => {
  const log = await healthService.upsertHealthLog(req.userId, req.body)
  const readiness = engine.calculateReadiness(log)
  res.json({ log, readiness })
})

export const getTodayHealth = wrap(async (req, res) => {
  const log = await healthService.getTodayHealthLog(req.userId)
  const readiness = log ? engine.calculateReadiness(log) : engine.calculateReadiness(null)
  res.json({ log, readiness })
})

export const getHealthHistory = wrap(async (req, res) => {
  const days    = Number(req.query.days) || 14
  const history = await healthService.getHealthHistory(req.userId, days)
  res.json(history)
})
