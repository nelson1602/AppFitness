import { prisma } from '@/config/prisma'
import { AppError } from '@/utils/errors'
import { incrementCounter, buildGamificationContext, checkAndUnlockAchievements } from './gamification.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toISOString().split('T')[0]

const getMondayStr = (d: Date): string => {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = utc.getUTCDay()
  utc.setUTCDate(utc.getUTCDate() - day + (day === 0 ? -6 : 1))
  return utc.toISOString().split('T')[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nextLevelXp = (level: number): number => {
  const thresholds = [0, 500, 1500, 3000, 5000]
  if (level <= 4) return thresholds[level]
  return 5000 + (level - 4) * 2000
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export const getSummary = async (userId: string) => {
  const now = new Date()
  const weekStart = new Date(getMondayStr(now) + 'T00:00:00.000Z')
  const weekStartStr = getMondayStr(now)

  const [workoutsThisWeek, latestWeight, setsThisWeek, stats, mealsThisWeek] = await Promise.all([
    prisma.workoutLog.count({
      where: { userId, startedAt: { gte: weekStart }, finishedAt: { not: null } },
    }),
    prisma.bodyWeight.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { weight: true, date: true },
    }),
    prisma.workoutSet.findMany({
      where: {
        completed: true,
        workoutLog: { userId, startedAt: { gte: weekStart }, finishedAt: { not: null } },
      },
      select: { reps: true, weight: true },
    }),
    prisma.userStats.findUnique({
      where: { userId },
      select: { currentStreak: true, level: true, xp: true, totalXp: true },
    }),
    prisma.meal.count({
      where: { nutritionLog: { userId, date: { gte: weekStartStr } } },
    }),
  ])

  const volumeThisWeek = setsThisWeek.reduce(
    (acc, s) => acc + (s.reps ?? 0) * (s.weight ?? 0),
    0,
  )

  const streak  = stats?.currentStreak ?? 0
  const level   = stats?.level         ?? 1
  const xp      = stats?.xp            ?? 0
  const totalXp = stats?.totalXp       ?? 0

  const daysSinceWeight = latestWeight
    ? Math.floor((Date.now() - new Date(latestWeight.date + 'T00:00:00').getTime()) / 86400000)
    : 999

  const fitnessScore = Math.min(100, Math.round(
    Math.min(streak * 5, 25) +
    Math.min(workoutsThisWeek * 10, 30) +
    (daysSinceWeight <= 7 ? 10 : 0) +
    Math.min(mealsThisWeek * 2, 20) +
    Math.min((level - 1) * 5, 15),
  ))

  return {
    workoutsThisWeek,
    volumeThisWeek: Math.round(volumeThisWeek),
    latestWeight:     latestWeight?.weight ?? null,
    latestWeightDate: latestWeight?.date   ?? null,
    streak,
    level,
    xp,
    totalXp,
    nextLevelXp: nextLevelXp(level),
    fitnessScore,
  }
}

// ─── Coach insight ────────────────────────────────────────────────────────────

export const getCoachInsight = async (userId: string) => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { primaryGoal: true, trainingDaysPerWeek: true, updatedAt: true },
  })
  if (!profile) return null

  const nextEval = new Date(profile.updatedAt)
  nextEval.setDate(nextEval.getDate() + 28)
  const daysToNextEval = Math.ceil((nextEval.getTime() - Date.now()) / 86400000)

  return {
    goal: profile.primaryGoal,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    daysToNextEval: Math.max(0, daysToNextEval),
  }
}

// ─── Weight history ───────────────────────────────────────────────────────────

export const getWeightHistory = (userId: string, weeks = 12) => {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  return prisma.bodyWeight.findMany({
    where: { userId, date: { gte: toDateStr(since) } },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, weight: true },
  })
}

// ─── Weekly training volume ───────────────────────────────────────────────────

export const getWeeklyVolume = async (userId: string, weeks = 8) => {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const sets = await prisma.workoutSet.findMany({
    where: {
      completed: true,
      workoutLog: { userId, startedAt: { gte: since }, finishedAt: { not: null } },
    },
    select: {
      reps: true,
      weight: true,
      workoutLog: { select: { startedAt: true } },
    },
  })

  // Pre-fill last N week buckets so weeks with no training show as 0
  const buckets = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    buckets.set(getMondayStr(d), 0)
  }

  for (const s of sets) {
    const key = getMondayStr(new Date(s.workoutLog.startedAt))
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + (s.reps ?? 0) * (s.weight ?? 0))
    }
  }

  return Array.from(buckets.entries()).map(([week, volume]) => ({
    week,
    volume: Math.round(volume),
  }))
}

// ─── Current week nutrition ────────────────────────────────────────────────────

export const getNutritionWeek = async (userId: string) => {
  const monday = getMondayStr(new Date())
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    days.push(toDateStr(d))
  }

  const logs = await prisma.nutritionLog.findMany({
    where: { userId, date: { in: days } },
    include: {
      meals: {
        include: {
          items: {
            include: { food: { select: { calories: true, protein: true, carbs: true, fat: true } } },
          },
        },
      },
    },
  })

  const logMap = new Map(logs.map((l) => [l.date, l]))

  return days.map((date) => {
    const items = logMap.get(date)?.meals.flatMap((m) => m.items) ?? []
    const t = items.reduce(
      (acc, item) => {
        const f = item.quantity / 100
        return {
          calories: acc.calories + item.food.calories * f,
          protein:  acc.protein  + item.food.protein  * f,
          carbs:    acc.carbs    + item.food.carbs    * f,
          fat:      acc.fat      + item.food.fat      * f,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )
    return {
      date,
      calories: Math.round(t.calories),
      protein:  Math.round(t.protein),
      carbs:    Math.round(t.carbs),
      fat:      Math.round(t.fat),
    }
  })
}

// ─── Body weight CRUD ─────────────────────────────────────────────────────────

export const logBodyWeight = async (userId: string, weight: number, date: string, notes?: string) => {
  const entry = await prisma.bodyWeight.upsert({
    where:  { userId_date: { userId, date } },
    update: { weight, ...(notes !== undefined ? { notes } : {}) },
    create: { userId, weight, date, notes },
  })

  // Fire-and-forget: increment stat + check achievements
  void (async () => {
    try {
      await incrementCounter(userId, 'weightsLogged')
      const ctx = await buildGamificationContext(userId)
      await checkAndUnlockAchievements(userId, ctx)
    } catch {}
  })()

  return entry
}

export const deleteBodyWeight = async (userId: string, id: string) => {
  const entry = await prisma.bodyWeight.findFirst({ where: { id, userId }, select: { id: true } })
  if (!entry) throw new AppError('Entry not found', 404)
  await prisma.bodyWeight.delete({ where: { id } })
}
