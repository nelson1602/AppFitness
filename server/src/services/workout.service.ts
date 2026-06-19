import { prisma } from '@/config/prisma'
import { AppError } from '@/utils/errors'
import { buildGamificationContext, checkAndUnlockAchievements } from './gamification.service'
import type {
  CreateRoutineInput,
  UpdateRoutineInput,
  SetRoutineExercisesInput,
  StartWorkoutInput,
  LogSetInput,
  UpdateSetInput,
} from '@/models/workout.model'

const EXERCISE_SELECT = {
  id: true,
  name: true,
  muscleGroup: true,
  category: true,
  instructions: true,
} as const

const ROUTINE_INCLUDE = {
  exercises: {
    include: { exercise: { select: EXERCISE_SELECT } },
    orderBy: { order: 'asc' as const },
  },
}

const LOG_INCLUDE = {
  routine: {
    select: {
      id: true,
      name: true,
      exercises: {
        select:  { exerciseId: true, order: true },
        orderBy: { order: 'asc' as const },
      },
    },
  },
  sets: {
    include: { exercise: { select: EXERCISE_SELECT } },
    orderBy: { setNumber: 'asc' as const },
  },
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export const getExercises = (search?: string, muscleGroup?: string) =>
  prisma.exercise.findMany({
    where: {
      ...(search && { name: { contains: search } }),
      ...(muscleGroup && { muscleGroup }),
    },
    select: EXERCISE_SELECT,
    orderBy: { name: 'asc' },
  })

export const getMuscleGroups = async () => {
  const exercises = await prisma.exercise.findMany({ select: { muscleGroup: true } })
  return [...new Set(exercises.map((e) => e.muscleGroup))].sort()
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export const getUserRoutines = (userId: string) =>
  prisma.routine.findMany({
    where: { userId },
    include: ROUTINE_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  })

export const getRoutineById = async (id: string, userId: string) => {
  const routine = await prisma.routine.findFirst({
    where: { id, userId },
    include: ROUTINE_INCLUDE,
  })
  if (!routine) throw new AppError('Routine not found', 404)
  return routine
}

export const createRoutine = (userId: string, data: CreateRoutineInput) =>
  prisma.routine.create({ data: { ...data, userId }, include: ROUTINE_INCLUDE })

export const updateRoutine = async (id: string, userId: string, data: UpdateRoutineInput) => {
  await assertRoutineOwner(id, userId)
  return prisma.routine.update({ where: { id }, data, include: ROUTINE_INCLUDE })
}

export const deleteRoutine = async (id: string, userId: string) => {
  await assertRoutineOwner(id, userId)
  await prisma.routine.delete({ where: { id } })
}

export const setRoutineExercises = async (
  routineId: string,
  userId: string,
  { exercises }: SetRoutineExercisesInput,
) => {
  await assertRoutineOwner(routineId, userId)
  await prisma.$transaction([
    prisma.routineExercise.deleteMany({ where: { routineId } }),
    prisma.routineExercise.createMany({
      data: exercises.map((e) => ({ ...e, routineId })),
    }),
  ])
  return getRoutineById(routineId, userId)
}

// ─── Workout logs ─────────────────────────────────────────────────────────────

export const getUserLogs = (userId: string, limit = 20, offset = 0) =>
  prisma.workoutLog.findMany({
    where: { userId },
    include: LOG_INCLUDE,
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
  })

export const startWorkout = async (userId: string, data: StartWorkoutInput) => {
  type RoutineEx = { exerciseId: string; order: number; targetReps: number | null; targetWeight: number | null }
  let routineExercises: RoutineEx[] = []

  if (data.routineId) {
    const routine = await prisma.routine.findFirst({
      where: { id: data.routineId, userId },
      include: {
        exercises: {
          select: { exerciseId: true, order: true, targetReps: true, targetWeight: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!routine) throw new AppError('Routine not found', 404)
    routineExercises = routine.exercises
  }

  const log = await prisma.workoutLog.create({
    data: { ...data, userId },
    select: { id: true },
  })

  if (routineExercises.length > 0) {
    await prisma.workoutSet.createMany({
      data: routineExercises.map(re => ({
        workoutLogId: log.id,
        exerciseId:   re.exerciseId,
        setNumber:    1,
        reps:         re.targetReps  ?? null,
        weight:       re.targetWeight ?? null,
        completed:    false,
      })),
    })
  }

  return prisma.workoutLog.findUnique({ where: { id: log.id }, include: LOG_INCLUDE })!
}

export const getWorkoutLogById = async (id: string, userId: string) => {
  const log = await prisma.workoutLog.findFirst({ where: { id, userId }, include: LOG_INCLUDE })
  if (!log) throw new AppError('Workout not found', 404)
  return log
}

export const finishWorkout = async (id: string, userId: string, notes?: string) => {
  await assertLogOwner(id, userId)

  const existing = await prisma.workoutLog.findFirst({
    where: { id, userId },
    select: {
      startedAt:  true,
      finishedAt: true,
      sets: {
        where:  { completed: true },
        select: { exerciseId: true, weight: true, reps: true },
      },
    },
  })
  if (!existing) throw new AppError('Workout not found', 404)
  if (existing.finishedAt) throw new AppError('Workout already finished', 400)

  const finishedAt = new Date()
  await prisma.workoutLog.update({
    where: { id },
    data:  { finishedAt, ...(notes ? { notes } : {}) },
  })

  const durationMins  = Math.round((finishedAt.getTime() - new Date(existing.startedAt).getTime()) / 60_000)
  const volumeKg      = existing.sets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0)
  const setsCompleted = existing.sets.length
  const prsSet        = await detectPRs(userId, id, existing.sets)
  const xpEarned      = 50 + prsSet * 25

  await updateStatsOnFinish(userId, xpEarned, prsSet)

  const gamCtx  = await buildGamificationContext(userId)
  const newAchs = await checkAndUnlockAchievements(userId, gamCtx)

  return {
    durationMins,
    volumeKg,
    setsCompleted,
    prsSet,
    xpEarned,
    newAchievements: newAchs.map((a) => ({
      key:      a.key,
      name:     a.name,
      icon:     a.icon,
      xpReward: a.xpReward,
    })),
  }
}

export const getLastPerformance = async (exerciseId: string, userId: string) => {
  const set = await prisma.workoutSet.findFirst({
    where: {
      exerciseId,
      completed: true,
      workoutLog: { userId, finishedAt: { not: null } },
    },
    orderBy: { workoutLog: { startedAt: 'desc' } },
    select:  { reps: true, weight: true },
  })
  return set ?? null
}

export const getExerciseHistory = async (exerciseId: string, userId: string, limit = 20) => {
  const sets = await prisma.workoutSet.findMany({
    where: {
      exerciseId,
      completed: true,
      workoutLog: { userId, finishedAt: { not: null } },
    },
    include: {
      workoutLog: { select: { id: true, name: true, startedAt: true } },
    },
    orderBy: { workoutLog: { startedAt: 'desc' } },
  })

  // Group by workoutLogId, keep most recent `limit` sessions
  const sessionMap = new Map<string, {
    date: string; workoutName: string; workoutLogId: string
    maxWeightKg: number; bestReps: number; totalVolumeKg: number; setCount: number
  }>()

  for (const s of sets) {
    const logId = s.workoutLog.id
    if (!sessionMap.has(logId)) {
      sessionMap.set(logId, {
        date:          s.workoutLog.startedAt.toISOString().split('T')[0],
        workoutName:   s.workoutLog.name,
        workoutLogId:  logId,
        maxWeightKg:   0,
        bestReps:      0,
        totalVolumeKg: 0,
        setCount:      0,
      })
    }
    const entry = sessionMap.get(logId)!
    const w = s.weight ?? 0
    const r = s.reps   ?? 0
    if (w > entry.maxWeightKg || (w === entry.maxWeightKg && r > entry.bestReps)) {
      entry.maxWeightKg = w
      entry.bestReps    = r
    }
    entry.totalVolumeKg += w * r
    entry.setCount      += 1
  }

  return Array.from(sessionMap.values()).slice(0, limit)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const detectPRs = async (
  userId: string,
  logId:  string,
  sets:   Array<{ exerciseId: string; weight: number | null; reps: number | null }>,
) => {
  const withLoad = sets.filter(s => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0)
  if (!withLoad.length) return 0

  const currentMax = new Map<string, number>()
  for (const s of withLoad) {
    const val = (s.weight ?? 0) * (s.reps ?? 0)
    if (val > (currentMax.get(s.exerciseId) ?? 0)) currentMax.set(s.exerciseId, val)
  }

  let count = 0
  for (const [exerciseId, newVal] of currentMax) {
    const prevBetter = await prisma.workoutSet.findFirst({
      where: {
        exerciseId,
        completed: true,
        workoutLog: { userId, id: { not: logId }, finishedAt: { not: null } },
      },
      orderBy: [{ weight: 'desc' as const }, { reps: 'desc' as const }],
      select:  { weight: true, reps: true },
    })
    const prevVal = prevBetter ? (prevBetter.weight ?? 0) * (prevBetter.reps ?? 0) : 0
    if (newVal > prevVal) count++
  }
  return count
}

const computeLevel = (totalXp: number) => {
  if (totalXp < 500)  return 1
  if (totalXp < 1500) return 2
  if (totalXp < 3000) return 3
  if (totalXp < 5000) return 4
  return 5 + Math.floor((totalXp - 5000) / 2000)
}

const updateStatsOnFinish = async (userId: string, xpEarned: number, prsSet: number) => {
  const today = new Date().toISOString().split('T')[0]
  const stats = await prisma.userStats.findUnique({ where: { userId } })

  let newStreak = 1
  if (stats?.lastActivityDate) {
    const diffDays = Math.round(
      (new Date(today).getTime() - new Date(stats.lastActivityDate).getTime()) / 86_400_000,
    )
    if (diffDays === 0) newStreak = stats.currentStreak
    else if (diffDays === 1) newStreak = stats.currentStreak + 1
  }

  if (stats) {
    await prisma.userStats.update({
      where: { userId },
      data: {
        workoutsLogged:  stats.workoutsLogged + 1,
        currentStreak:   newStreak,
        longestStreak:   Math.max(newStreak, stats.longestStreak),
        lastActivityDate: today,
        prsSet:          stats.prsSet + prsSet,
        xp:              stats.xp + xpEarned,
        totalXp:         stats.totalXp + xpEarned,
        level:           computeLevel(stats.totalXp + xpEarned),
      },
    })
  } else {
    await prisma.userStats.create({
      data: {
        userId,
        workoutsLogged: 1,
        currentStreak:  1,
        longestStreak:  1,
        lastActivityDate: today,
        prsSet,
        xp:      xpEarned,
        totalXp: xpEarned,
        level:   1,
      },
    })
  }
}

export const deleteWorkoutLog = async (id: string, userId: string) => {
  await assertLogOwner(id, userId)
  await prisma.workoutLog.delete({ where: { id } })
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

export const addSet = async (workoutLogId: string, userId: string, data: LogSetInput) => {
  await assertLogOwner(workoutLogId, userId)
  const exercise = await prisma.exercise.findUnique({ where: { id: data.exerciseId }, select: { id: true } })
  if (!exercise) throw new AppError('Exercise not found', 404)
  return prisma.workoutSet.create({
    data: { ...data, workoutLogId },
    include: { exercise: { select: EXERCISE_SELECT } },
  })
}

export const updateSet = async (id: string, userId: string, data: UpdateSetInput) => {
  const set = await prisma.workoutSet.findFirst({
    where: { id },
    include: { workoutLog: { select: { userId: true } } },
  })
  if (!set || set.workoutLog.userId !== userId) throw new AppError('Set not found', 404)
  return prisma.workoutSet.update({
    where: { id },
    data,
    include: { exercise: { select: EXERCISE_SELECT } },
  })
}

export const deleteSet = async (id: string, userId: string) => {
  const set = await prisma.workoutSet.findFirst({
    where: { id },
    include: { workoutLog: { select: { userId: true } } },
  })
  if (!set || set.workoutLog.userId !== userId) throw new AppError('Set not found', 404)
  await prisma.workoutSet.delete({ where: { id } })
}

// ─── Guards ───────────────────────────────────────────────────────────────────

const assertRoutineOwner = async (id: string, userId: string) => {
  const r = await prisma.routine.findFirst({ where: { id, userId }, select: { id: true } })
  if (!r) throw new AppError('Routine not found', 404)
}

const assertLogOwner = async (id: string, userId: string) => {
  const l = await prisma.workoutLog.findFirst({ where: { id, userId }, select: { id: true } })
  if (!l) throw new AppError('Workout not found', 404)
}
