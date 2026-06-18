import { z } from 'zod'

export const createRoutineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
})

export const updateRoutineSchema = createRoutineSchema.partial()

export const setRoutineExercisesSchema = z.object({
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      order: z.number().int().min(0),
      targetSets: z.number().int().positive().nullish(),
      targetReps: z.number().int().positive().nullish(),
      targetWeight: z.number().positive().nullish(),
    }),
  ),
})

export const startWorkoutSchema = z.object({
  routineId: z.string().optional(),
  name: z.string().min(1).max(100),
})

export const finishWorkoutSchema = z.object({
  notes: z.string().max(500).optional(),
})

export const logSetSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive().optional(),
  weight: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  completed: z.boolean().default(false),
  notes: z.string().max(200).optional(),
})

export const updateSetSchema = z.object({
  reps: z.number().int().positive().optional(),
  weight: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(200).optional(),
})

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>
export type SetRoutineExercisesInput = z.infer<typeof setRoutineExercisesSchema>
export type StartWorkoutInput = z.infer<typeof startWorkoutSchema>
export type LogSetInput = z.infer<typeof logSetSchema>
export type UpdateSetInput = z.infer<typeof updateSetSchema>
