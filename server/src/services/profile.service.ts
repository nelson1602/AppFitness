import { prisma } from '@/config/prisma'

export interface ProfileInput {
  birthDate?:          string
  gender?:             string
  heightCm?:           number
  primaryGoal?:        string
  targetWeightKg?:     number
  targetDate?:         string
  fitnessLevel?:       string
  yearsTraining?:      number
  activityLevel?:      string
  occupation?:         string
  sleepHours?:         number
  stressLevel?:        number
  equipment?:          string[]
  trainingDaysPerWeek?: number
  sessionDurationMins?: number
}

export const getProfile = (userId: string) =>
  prisma.userProfile.findUnique({
    where: { userId },
  })

export const upsertProfile = async (userId: string, data: ProfileInput) => {
  const { equipment, ...rest } = data
  const equipmentStr = equipment !== undefined ? JSON.stringify(equipment) : undefined

  return prisma.userProfile.upsert({
    where:  { userId },
    create: { userId, ...rest, ...(equipmentStr !== undefined ? { equipment: equipmentStr } : {}) },
    update: { ...rest,         ...(equipmentStr !== undefined ? { equipment: equipmentStr } : {}) },
  })
}

export const updateTargets = (
  userId:    string,
  calories:  number,
  proteinG:  number,
  carbsG:    number,
  fatG:      number,
) =>
  prisma.userProfile.upsert({
    where:  { userId },
    create: { userId, targetCalories: calories, targetProteinG: proteinG, targetCarbsG: carbsG, targetFatG: fatG },
    update: { targetCalories: calories, targetProteinG: proteinG, targetCarbsG: carbsG, targetFatG: fatG },
  })
