import { z } from 'zod'

const emailField = (msg = 'Enter a valid email address (e.g. you@example.com)') =>
  z.string()
    .email(msg)
    .refine(
      (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v),
      msg,
    )

export const registerSchema = z.object({
  email: emailField(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72),
})

export const loginSchema = z.object({
  email: emailField(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'At least 8 characters').max(72),
})

export const updateAccountSchema = z.object({
  email:     emailField().optional(),
  phone:     z.string().max(20).optional(),
  avatarUrl: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
})

export type RegisterInput        = z.infer<typeof registerSchema>
export type LoginInput           = z.infer<typeof loginSchema>
export type RefreshInput         = z.infer<typeof refreshSchema>
export type ChangePasswordInput  = z.infer<typeof changePasswordSchema>
export type UpdateAccountInput   = z.infer<typeof updateAccountSchema>
