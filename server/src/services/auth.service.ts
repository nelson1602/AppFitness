import { prisma } from '@/config/prisma'
import { hashPassword, comparePassword } from '@/utils/hash'
import { signAccessToken, signRefreshToken, verifyRefreshToken, msFromExpiry } from '@/utils/jwt'
import { AppError } from '@/utils/errors'
import { env } from '@/config/env'
import type { RegisterInput, LoginInput } from '@/models/auth.model'

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  createdAt: true,
} as const

const buildTokenPair = async (userId: string) => {
  const accessToken = signAccessToken(userId)
  const refreshToken = signRefreshToken(userId)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + msFromExpiry(env.JWT_REFRESH_EXPIRES_IN)),
    },
  })

  return { accessToken, refreshToken }
}

export const register = async ({ email, username, password }: RegisterInput) => {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  })

  if (existing) {
    throw new AppError(
      existing.email === email ? 'Email already in use' : 'Username already taken',
      409,
    )
  }

  const user = await prisma.user.create({
    data: { email, username, passwordHash: await hashPassword(password) },
    select: SAFE_USER_SELECT,
  })

  const tokens = await buildTokenPair(user.id)
  return { user, ...tokens }
}

export const login = async ({ email, password }: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError('Invalid credentials', 401)
  }

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  })

  const tokens = await buildTokenPair(user.id)
  return { user: safeUser, ...tokens }
}

export const refresh = async (token: string) => {
  const payload = verifyRefreshToken(token)
  if (!payload) throw new AppError('Invalid refresh token', 401)

  const stored = await prisma.refreshToken.findUnique({ where: { token } })

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { token } })
    throw new AppError('Refresh token expired', 401)
  }

  // Token rotation
  await prisma.refreshToken.delete({ where: { token } })
  const tokens = await buildTokenPair(stored.userId)
  return tokens
}

export const logout = async (token: string) => {
  await prisma.refreshToken.deleteMany({ where: { token } })
}

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  })
  if (!user) throw new AppError('User not found', 404)
  return user
}
