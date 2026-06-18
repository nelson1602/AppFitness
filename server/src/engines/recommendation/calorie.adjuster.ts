import type { ActivityLevel, PrimaryGoal, TDEEInput } from './recommendation.types'
import type { UserProfileData }                        from '../coach/coach.types'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:   1.20,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.90,
}

export function calcAgeYears(birthDate: string | null): number {
  if (!birthDate) return 30
  const today = new Date()
  const birth = new Date(birthDate + 'T12:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(15, Math.min(90, age))
}

export function calculateTDEE(input: TDEEInput): number {
  const { weightKg, heightCm, ageYears, gender, activityLevel } = input
  // Mifflin-St Jeor
  const bmr =
    gender === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55))
}

export function getTDEEInput(profile: UserProfileData, currentWeightKg: number): TDEEInput {
  return {
    weightKg:      currentWeightKg,
    heightCm:      profile.heightCm ?? 170,
    ageYears:      calcAgeYears(profile.birthDate),
    gender:        (profile.gender as 'male' | 'female' | 'other') ?? 'male',
    activityLevel: (profile.activityLevel as ActivityLevel) ?? 'moderate',
  }
}

export function adjustCalories(
  tdee:                 number,
  goal:                 PrimaryGoal,
  weeklyWeightChangeKg: number,
  adherenceRate:        number,
): { calories: number; rationale: string[] } {
  const rationale: string[] = []
  let target = tdee

  if (goal === 'lose_fat') {
    target = tdee - 400
    rationale.push('400 kcal deficit targeting ~0.4 kg/week fat loss')
    if (!isNaN(weeklyWeightChangeKg)) {
      if (weeklyWeightChangeKg > -0.1) {
        target -= 100
        rationale.push('Progress stalled — extra 100 kcal cut applied')
      } else if (weeklyWeightChangeKg < -0.9) {
        target += 150
        rationale.push('Losing too fast — +150 kcal to protect muscle')
      }
    }
  } else if (goal === 'build_muscle') {
    target = tdee + 250
    rationale.push('250 kcal lean bulk surplus')
    if (!isNaN(weeklyWeightChangeKg)) {
      if (weeklyWeightChangeKg < 0.05) {
        target += 100
        rationale.push('Not gaining — +100 kcal added')
      } else if (weeklyWeightChangeKg > 0.45) {
        target -= 100
        rationale.push('Gaining too fast — −100 kcal to limit fat gain')
      }
    }
  } else if (goal === 'improve_performance') {
    target = tdee + 100
    rationale.push('Small surplus to fuel performance and recovery')
  } else {
    rationale.push('Maintenance calories (TDEE)')
  }

  if (adherenceRate < 0.70) {
    target += 100
    rationale.push('Low adherence — +100 kcal for sustainability')
  }

  return { calories: Math.round(Math.max(1200, target)), rationale }
}
