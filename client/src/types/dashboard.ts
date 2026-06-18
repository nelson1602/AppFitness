export interface DashboardSummary {
  workoutsThisWeek: number
  volumeThisWeek: number
  latestWeight: number | null
  latestWeightDate: string | null
}

export interface WeightEntry {
  id: string
  date: string
  weight: number
}

export interface WeeklyVolume {
  week: string
  volume: number
}

export interface DailyNutrition {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
}
