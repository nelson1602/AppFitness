import { Request, Response, NextFunction } from 'express'
import * as authService from '@/services/auth.service'

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.refresh(req.body.refreshToken)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.body.refreshToken)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.userId)
    res.json(user)
  } catch (err) {
    next(err)
  }
}

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.changePassword(req.userId, req.body)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const updateAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateAccount(req.userId, req.body)
    res.json(user)
  } catch (err) {
    next(err)
  }
}
