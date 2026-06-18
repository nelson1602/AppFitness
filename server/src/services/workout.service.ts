import { prisma } from '@/config/prisma'
import { AppError } from '@/utils/errors'
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
  routine: { select: { id: true, name: true } },
  sets: {
    include: { exercise: { select: EXERCISE_SELECT } },
    orderBy: [{ exerciseId: 'asc' as const }, { setNumber: 'asc' as const }],
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
  if (data.routineId) {
    const exists = await prisma.routine.findFirst({
      where: { id: data.routineId, userId },
      select: { id: true },
    })
    if (!exists) throw new AppError('Routine not found', 404)
  }
  return prisma.workoutLog.create({ data: { ...data, userId }, include: LOG_INCLUDE })
}

export const getWorkoutLogById = async (id: string, userId: string) => {
  const log = await prisma.workoutLog.findFirst({ where: { id, userId }, include: LOG_INCLUDE })
  if (!log) throw new AppError('Workout not found', 404)
  return log
}

export const finishWorkout = async (id: string, userId: string, notes?: string) => {
  await assertLogOwner(id, userId)
  return prisma.workoutLog.update({
    where: { id },
    data: { finishedAt: new Date(), ...(notes ? { notes } : {}) },
  })
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
