import dns   from 'dns/promises'
import { prisma } from '@/config/prisma'
import { hashPassword, comparePassword } from '@/utils/hash'
import { signAccessToken, signRefreshToken, verifyRefreshToken, msFromExpiry } from '@/utils/jwt'
import { AppError } from '@/utils/errors'
import { env } from '@/config/env'
import type { RegisterInput, LoginInput, ChangePasswordInput, UpdateAccountInput } from '@/models/auth.model'

const domainAcceptsEmail = async (email: string): Promise<boolean> => {
  const domain = email.split('@')[1]
  if (!domain) return false

  // dns.lookup() uses the OS resolver (getaddrinfo) — reliable on all platforms including Windows.
  // dns.resolveMx/resolve bypass the OS and query DNS directly, which is blocked in many environments.
  try {
    await dns.lookup(domain)
    return true  // domain resolved → exists
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOTFOUND') return false  // domain does not exist
    return true                             // network/OS error → fail open
  }
}

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  phone: true,
  avatarUrl: true,
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
  const [existing, validDomain] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true },
    }),
    domainAcceptsEmail(email),
  ])

  if (!validDomain) {
    throw new AppError('Email domain does not exist or cannot receive emails. Please use a valid email address.', 400)
  }

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

export const changePassword = async (userId: string, { currentPassword, newPassword }: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  if (!user) throw new AppError('User not found', 404)

  const valid = await comparePassword(currentPassword, user.passwordHash)
  if (!valid) throw new AppError('Current password is incorrect', 400)

  await prisma.user.update({
    where: { id: userId },
    data:  { passwordHash: await hashPassword(newPassword) },
  })
}

export const updateAccount = async (userId: string, data: UpdateAccountInput) => {
  if (data.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: userId } },
      select: { id: true },
    })
    if (conflict) throw new AppError('Email already in use', 409)
  }

  return prisma.user.update({
    where:  { id: userId },
    data:   { ...data, avatarUrl: data.avatarUrl || null },
    select: SAFE_USER_SELECT,
  })
}
