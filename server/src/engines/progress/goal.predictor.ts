import type { GoalPrediction } from './progress.types'

function linReg(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }

  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sumXX - sumX * sumX

  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope     = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const yMean = sumY / n
  const ssTot = ys.reduce((acc, y) => acc + (y - yMean) ** 2, 0)
  const ssRes = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i] + intercept)) ** 2, 0)
  const r2    = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2 }
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + Math.round(days))
  return d.toISOString().split('T')[0]
}

export function predictGoalDate(
  recentWeights:  Array<{ date: string; weight: number }>,
  targetWeightKg: number | null,
  goal:           string,
): GoalPrediction {
  if (!targetWeightKg || goal === 'maintain' || goal === 'improve_performance') {
    return { canPredict: false, reason: 'no_target' }
  }
  if (recentWeights.length < 4) {
    return { canPredict: false, reason: 'insufficient_data' }
  }

  const sorted = [...recentWeights].sort((a, b) => a.date.localeCompare(b.date))
  const xs     = sorted.map((_, i) => i)
  const ys     = sorted.map(w => w.weight)

  const { slope, intercept, r2 } = linReg(xs, ys)

  const isMovingRight = goal === 'lose_fat' ? slope < 0 : slope > 0
  if (Math.abs(slope) < 0.01 || !isMovingRight) {
    return { canPredict: false, reason: 'plateau', weeklyRateKg: slope }
  }

  // Solve: targetWeight = slope * x + intercept → x = (target - intercept) / slope
  const xTarget      = (targetWeightKg - intercept) / slope
  const xCurrent     = sorted.length - 1
  const entriesLeft  = xTarget - xCurrent
  const weeksLeft    = Math.max(0, entriesLeft)  // assume ~1 entry/week

  const today = new Date()
  const confidence = Math.round(Math.min(95, Math.max(25, r2 * 100)))

  return {
    canPredict:        true,
    estimatedDate:     addDays(today, weeksLeft * 7),
    weeksRemaining:    Math.round(weeksLeft),
    weeklyRateKg:      Math.round(slope * 100) / 100,
    confidencePercent: confidence,
    bestCase:          addDays(today, weeksLeft * 7 * 0.75),
    worstCase:         addDays(today, weeksLeft * 7 * 1.40),
  }
}
