import type { ProgressSnapshotData } from '../coach/coach.types'
import type { PlateauResult }         from './progress.types'

export function detectWeightPlateau(
  snapshots: ProgressSnapshotData[],
  goal:      string,
): PlateauResult {
  if (goal === 'maintain') return { detected: false }

  const withWeight = snapshots
    .filter(s => s.avgWeightKg != null)
    .slice(-5)

  if (withWeight.length < 3) return { detected: false }

  const weights      = withWeight.map(s => s.avgWeightKg!)
  const first        = weights[0]
  const last         = weights[weights.length - 1]
  const percentChange = Math.abs((last - first) / first) * 100

  if (percentChange < 0.5) {
    return {
      detected:     true,
      type:         'weight',
      durationWeeks: withWeight.length,
      recommendation:
        goal === 'lose_fat'
          ? 'Weight plateau — try cutting 100–150 kcal or adding 20 min of cardio'
          : 'Weight plateau — try adding 100–150 kcal and ensuring progressive overload',
    }
  }

  return { detected: false }
}
