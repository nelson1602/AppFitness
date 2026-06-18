import { z } from 'zod'

export const ProfileSchema = z.object({
  birthDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender:              z.enum(['male', 'female', 'other']).optional(),
  heightCm:            z.number().positive().max(300).optional(),
  primaryGoal:         z.enum(['lose_fat', 'build_muscle', 'maintain', 'improve_performance']).optional(),
  targetWeightKg:      z.number().positive().max(500).optional(),
  targetDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fitnessLevel:        z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  yearsTraining:       z.number().min(0).max(60).optional(),
  activityLevel:       z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  occupation:          z.string().max(100).optional(),
  sleepHours:          z.number().min(2).max(16).optional(),
  stressLevel:         z.number().int().min(1).max(5).optional(),
  equipment:           z.array(
                         z.enum(['barbell', 'dumbbell', 'machines', 'cables', 'bodyweight', 'kettlebell', 'resistance_bands'])
                       ).optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  sessionDurationMins: z.number().int().min(15).max(240).optional(),
})
