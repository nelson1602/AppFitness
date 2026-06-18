import { prisma }       from '@/config/prisma'
import { CoachEngine }  from '@/engines/coach/coach.engine'
import { updateTargets } from './profile.service'
import type { CoachContext }     from '@/engines/coach/coach.types'
import type { CoachReport }      from '@/engines/coach/coach.types'
import type { UserProfileData }  from '@/engines/coach/coach.types'

const coachEngine = new CoachEngine()

// UTC-safe Monday string
const getMondayStr = (d: Date): string => {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day  = utc.getUTCDay()
  utc.setUTCDate(utc.getUTCDate() - day + (day === 0 ? -6 : 1))
  return utc.toISOString().split('T')[0]
}

export const buildCoachContext = async (userId: string): Promise<CoachContext> => {
  const mondayStr  = getMondayStr(new Date())
  const mondayDate = new Date(mondayStr + 'T00:00:00.000Z')

  const [profile, recentWeights, recentNutrition, recentWorkouts, latestHealthLog, stats, snapshots] =
    await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.bodyWeight.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 16 }),
      prisma.nutritionLog.findMany({
        where:   { userId },
        orderBy: { date: 'desc' },
        take:    7,
        include: { meals: { include: { items: { include: { food: true } } } } },
      }),
      prisma.workoutLog.findMany({
        where:   { userId },
        orderBy: { startedAt: 'desc' },
        take:    20,
        include: { sets: { select: { reps: true, weight: true, completed: true } } },
      }),
      prisma.healthLog.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.progressSnapshot.findMany({ where: { userId }, orderBy: { weekStart: 'asc' }, take: 12 }),
    ])

  const currentWeightKg = recentWeights[0]?.weight ?? 70

  const avgNutrient = (key: 'calories' | 'protein') => {
    if (!recentNutrition.length) return 0
    const total = recentNutrition.reduce((acc, log) => {
      const v = log.meals.reduce(
        (a, m) => a + m.items.reduce((b, item) => b + item.food[key] * (item.quantity / 100), 0),
        0,
      )
      return acc + v
    }, 0)
    return total / recentNutrition.length
  }

  const recentCalories  = avgNutrient('calories')
  const recentProteinG  = avgNutrient('protein')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const lastWeekLogs    = recentWorkouts.filter(w => w.startedAt >= sevenDaysAgo && w.finishedAt != null)
  const recentVolumeKg  = lastWeekLogs.reduce(
    (acc, w) => acc + w.sets.filter(s => s.completed).reduce((a, s) => a + (s.reps ?? 0) * (s.weight ?? 0), 0),
    0,
  )

  const avgVolumeKg = recentWorkouts.length
    ? recentWorkouts.reduce(
        (acc, w) => acc + w.sets.filter(s => s.completed).reduce((a, s) => a + (s.reps ?? 0) * (s.weight ?? 0), 0),
        0,
      ) / Math.max(1, Math.ceil(recentWorkouts.length / 7))
    : 0

  const workoutsThisWeek = recentWorkouts.filter(
    w => w.startedAt >= mondayDate && w.finishedAt != null,
  ).length

  const defaultProfile: UserProfileData = {
    primaryGoal: 'maintain', targetWeightKg: null, targetDate: null,
    fitnessLevel: 'intermediate', activityLevel: 'moderate',
    gender: null, birthDate: null, heightCm: null,
    trainingDaysPerWeek: 3, sessionDurationMins: 60, equipment: [],
    targetCalories: null, targetProteinG: null, targetCarbsG: null, targetFatG: null,
  }

  let profileData: UserProfileData = defaultProfile
  if (profile) {
    let equipment: string[] = []
    try { equipment = JSON.parse(profile.equipment ?? '[]') } catch { /* empty */ }
    profileData = { ...defaultProfile, ...profile, equipment }
  }

  return {
    userId,
    profile:              profileData,
    currentWeightKg,
    recentWeights:        [...recentWeights].reverse().map(w => ({ date: w.date, weight: w.weight })),
    recentCalories,
    recentProteinG,
    recentVolumeKg,
    avgVolumeKg,
    progressSnapshots:    snapshots,
    latestHealthLog:      latestHealthLog,
    currentTargets: {
      targetCalories: profile?.targetCalories  ?? null,
      targetProteinG: profile?.targetProteinG  ?? null,
      targetCarbsG:   profile?.targetCarbsG    ?? null,
      targetFatG:     profile?.targetFatG      ?? null,
    },
    stats: {
      currentStreak:  stats?.currentStreak  ?? 0,
      workoutsLogged: stats?.workoutsLogged ?? 0,
      prsSet:         stats?.prsSet         ?? 0,
    },
    workoutCountThisWeek: workoutsThisWeek,
    trainingDaysActual:   lastWeekLogs.length,
  }
}

export const generateCoachReport = async (userId: string): Promise<CoachReport> => {
  const ctx = await buildCoachContext(userId)
  return coachEngine.generateReport(ctx)
}

export const applyNutritionTargets = async (userId: string): Promise<void> => {
  const ctx    = await buildCoachContext(userId)
  const report = coachEngine.generateReport(ctx)
  const { targets } = report.nutritionRecommendation
  await updateTargets(userId, targets.calories, targets.proteinG, targets.carbsG, targets.fatG)
}

export const saveWeeklySnapshot = async (userId: string): Promise<void> => {
  const mondayStr = getMondayStr(new Date())
  const ctx       = await buildCoachContext(userId)
  const report    = coachEngine.generateReport(ctx)

  await prisma.progressSnapshot.upsert({
    where:  { userId_weekStart: { userId, weekStart: mondayStr } },
    create: {
      userId, weekStart: mondayStr,
      avgWeightKg:   ctx.currentWeightKg,
      totalVolumeKg: ctx.recentVolumeKg,
      avgCalories:   ctx.recentCalories,
      workoutCount:  ctx.workoutCountThisWeek,
      isDeloadWeek:  report.trainingRecommendation.isDeloadWeek,
    },
    update: {
      avgWeightKg:   ctx.currentWeightKg,
      totalVolumeKg: ctx.recentVolumeKg,
      avgCalories:   ctx.recentCalories,
      workoutCount:  ctx.workoutCountThisWeek,
      isDeloadWeek:  report.trainingRecommendation.isDeloadWeek,
    },
  })
}
