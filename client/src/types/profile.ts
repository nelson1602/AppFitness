export type PrimaryGoal  = 'lose_fat' | 'build_muscle' | 'maintain' | 'improve_performance'
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Equipment = 'barbell' | 'dumbbell' | 'machines' | 'cables' | 'bodyweight' | 'kettlebell' | 'resistance_bands'

export interface UserProfile {
  id:                     string
  userId:                 string
  birthDate:              string | null
  gender:                 string | null
  heightCm:               number | null
  primaryGoal:            PrimaryGoal
  targetWeightKg:         number | null
  targetDate:             string | null
  fitnessLevel:           FitnessLevel
  yearsTraining:          number
  activityLevel:          ActivityLevel
  occupation:             string | null
  sleepHours:             number
  stressLevel:            number
  equipment:              Equipment[]
  trainingDaysPerWeek:    number
  sessionDurationMins:    number
  targetCalories:         number | null
  targetProteinG:         number | null
  targetCarbsG:           number | null
  targetFatG:             number | null
  bloodPressureSystolic:  number | null
  bloodPressureDiastolic: number | null
  injuries:               string | null
}
