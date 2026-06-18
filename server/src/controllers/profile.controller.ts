import { Request, Response, NextFunction } from 'express'
import * as profileService from '@/services/profile.service'

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next)

export const getProfile = wrap(async (req, res) => {
  const profile = await profileService.getProfile(req.userId)
  if (!profile) { res.json(null); return }

  let equipment: string[] = []
  try { equipment = JSON.parse(profile.equipment ?? '[]') } catch { /* empty */ }

  res.json({ ...profile, equipment })
})

export const upsertProfile = wrap(async (req, res) => {
  const profile = await profileService.upsertProfile(req.userId, req.body)
  let equipment: string[] = []
  try { equipment = JSON.parse(profile.equipment ?? '[]') } catch { /* empty */ }
  res.json({ ...profile, equipment })
})
