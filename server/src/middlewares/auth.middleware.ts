import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '@/utils/jwt'

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const payload = verifyAccessToken(header.slice(7))
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.userId = payload.userId
  next()
}
