export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type PrimaryGoal  = 'lose_fat' | 'build_muscle' | 'maintain' | 'improve_performance'
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

export interface TDEEInput {
  weightKg:      number
  heightCm:      number
  ageYears:      number
  gender:        'male' | 'female' | 'other'
  activityLevel: ActivityLevel
}

export interface MacroTargets {
  calories:  number
  proteinG:  number
  carbsG:    number
  fatG:      number
}

export interface NutritionAdjustment {
  targets:   MacroTargets
  previous:  MacroTargets
  tdee:      number
  rationale: string[]
  changes: {
    calories: number
    protein:  number
    carbs:    number
    fat:      number
  }
}

export interface VolumeGuidelines {
  mev: number
  mav: number
  mrv: number
}

export interface TrainingAdjustment {
  recommendedFrequency: number
  volumeModifier:       number
  intensityModifier:    number
  isDeloadWeek:         boolean
  rationale:            string[]
}
