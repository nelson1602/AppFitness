import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/utils/errors'
import { env } from '@/config/env'

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  if (env.NODE_ENV === 'development') {
    console.error(err)
  }

  res.status(500).json({ error: 'Internal server error' })
}

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route not found' })
}
