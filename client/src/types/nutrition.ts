export interface Food {
  id: string
  name: string
  brand?: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number | null
}

export interface MealItem {
  id: string
  quantity: number
  food: Food
}

export interface Meal {
  id: string
  name: string
  order: number
  items: MealItem[]
}

export interface NutritionLog {
  id: string
  date: string
  notes?: string | null
  meals: Meal[]
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}
