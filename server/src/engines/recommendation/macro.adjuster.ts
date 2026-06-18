import type { PrimaryGoal, MacroTargets } from './recommendation.types'

const PROTEIN_MULTIPLIERS: Record<PrimaryGoal, number> = {
  lose_fat:            2.2,
  build_muscle:        1.8,
  maintain:            1.6,
  improve_performance: 2.0,
}

export function calculateMacros(
  calories:  number,
  weightKg:  number,
  goal:      PrimaryGoal,
): MacroTargets {
  const multiplier = PROTEIN_MULTIPLIERS[goal] ?? 1.8
  const proteinG   = Math.round(weightKg * multiplier)
  const proteinKcal = proteinG * 4

  // Fat: 28% of calories, minimum 0.8 g/kg
  const fatTargetG = Math.round((calories * 0.28) / 9)
  const fatMinG    = Math.round(weightKg * 0.8)
  const fatG       = Math.max(fatMinG, fatTargetG)
  const fatKcal    = fatG * 9

  // Carbs: remainder
  const carbsKcal = Math.max(0, calories - proteinKcal - fatKcal)
  const carbsG    = Math.round(carbsKcal / 4)

  return { calories, proteinG, carbsG, fatG }
}
