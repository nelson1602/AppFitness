import type { MealItem, MacroTotals } from '@/types/nutrition'

const ZERO: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export const calcItem = (item: MealItem): MacroTotals => {
  const f = item.quantity / 100
  return {
    calories: item.food.calories * f,
    protein:  item.food.protein  * f,
    carbs:    item.food.carbs    * f,
    fat:      item.food.fat      * f,
    fiber:    (item.food.fiber ?? 0) * f,
  }
}

export const sumMacros = (items: MealItem[]): MacroTotals =>
  items.reduce((acc, item) => {
    const m = calcItem(item)
    return {
      calories: acc.calories + m.calories,
      protein:  acc.protein  + m.protein,
      carbs:    acc.carbs    + m.carbs,
      fat:      acc.fat      + m.fat,
      fiber:    acc.fiber    + m.fiber,
    }
  }, { ...ZERO })

export const fmt = (n: number, decimals = 1) =>
  n < 10 ? n.toFixed(decimals) : Math.round(n).toString()
