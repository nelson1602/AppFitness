import { prisma }                  from '@/config/prisma'
import { AppError }                from '@/utils/errors'
import { calculateTDEE, calcAgeYears, adjustCalories } from '@/engines/recommendation/calorie.adjuster'
import { calculateMacros }         from '@/engines/recommendation/macro.adjuster'
import { sendReevaluationEmail }   from './email.service'
import type { PrimaryGoal, ActivityLevel, TDEEInput } from '@/engines/recommendation/recommendation.types'

const REEVAL_DAYS = 28

// ─── Status ───────────────────────────────────────────────────────────────────

export const getReevaluationStatus = async (userId: string) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { updatedAt: true },
  })
  if (!profile) return { due: false, daysUntil: REEVAL_DAYS, overdue: false }

  const nextEval = new Date(profile.updatedAt)
  nextEval.setDate(nextEval.getDate() + REEVAL_DAYS)
  const daysUntil = Math.ceil((nextEval.getTime() - Date.now()) / 86400000)

  return {
    due:      daysUntil <= 0,
    daysUntil: Math.max(0, daysUntil),
    overdue:  daysUntil < -3,
  }
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export const completeReevaluation = async (userId: string) => {
  const [profile, latestWeight] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.bodyWeight.findFirst({
      where:   { userId },
      orderBy: { date: 'desc' },
      select:  { weight: true },
    }),
  ])

  if (!profile) throw new AppError('Profile not found — complete your profile before reevaluation', 400)

  const weightKg = latestWeight?.weight ?? 70
  const tdeeInput: TDEEInput = {
    weightKg,
    heightCm:      profile.heightCm      ?? 170,
    ageYears:      calcAgeYears(profile.birthDate),
    gender:        (profile.gender       ?? 'male') as 'male' | 'female' | 'other',
    activityLevel: (profile.activityLevel ?? 'moderate') as ActivityLevel,
  }
  const tdee = calculateTDEE(tdeeInput)

  const { calories } = adjustCalories(
    tdee,
    (profile.primaryGoal as PrimaryGoal) ?? 'maintain',
    0,
    1.0,
  )

  const macros = calculateMacros(calories, weightKg, (profile.primaryGoal as PrimaryGoal) ?? 'maintain')

  // Update targets; @updatedAt resets automatically, resetting the 28-day timer
  await prisma.userProfile.update({
    where: { userId },
    data: {
      targetCalories: calories,
      targetProteinG: macros.proteinG,
      targetCarbsG:   macros.carbsG,
      targetFatG:     macros.fatG,
    },
  })

  return {
    tdee,
    calories:  macros.calories,
    proteinG:  macros.proteinG,
    carbsG:    macros.carbsG,
    fatG:      macros.fatG,
    weightUsed: weightKg,
  }
}

// ─── Email trigger (called by daily job) ─────────────────────────────────────

export const checkAndSendReevaluationEmail = async (userId: string) => {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } }),
    prisma.userProfile.findUnique({ where: { userId }, select: { updatedAt: true } }),
  ])

  if (!user || !profile) return

  const nextEval = new Date(profile.updatedAt)
  nextEval.setDate(nextEval.getDate() + REEVAL_DAYS)
  const daysUntil = Math.ceil((nextEval.getTime() - Date.now()) / 86400000)

  if (daysUntil !== 3 && daysUntil !== 0) return

  // Deduplicate — skip if we already sent this type of reminder today
  const today     = new Date().toISOString().split('T')[0]
  const notifType = daysUntil === 3 ? 'reevaluation_reminder_3d' : 'reevaluation_reminder_due'

  const alreadySent = await prisma.notification.findFirst({
    where: {
      userId,
      type: notifType,
      createdAt: { gte: new Date(today) },
    },
  })
  if (alreadySent) return

  await Promise.all([
    sendReevaluationEmail(user.email, user.username, daysUntil).catch(() => {}),
    prisma.notification.create({
      data: {
        userId,
        type:    notifType,
        title:   daysUntil === 3 ? 'Reevaluation in 3 days' : 'Reevaluation due today',
        message: daysUntil === 3
          ? 'Your 4-week fitness evaluation is coming up in 3 days.'
          : 'Time for your 4-week fitness evaluation!',
        data:    JSON.stringify({ daysUntil, date: today }),
      },
    }),
  ])
}
