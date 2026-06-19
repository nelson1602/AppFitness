import { Request, Response, NextFunction } from 'express'
import * as svc from '@/services/notification.service'

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

export const getNotifications = wrap(async (req, res) => {
  res.json(await svc.getNotifications(req.userId))
})
