import type { ProgressSnapshotData } from '../coach/coach.types'
import type { DeloadDecision }         from './progress.types'

export function countWeeksSinceLastDeload(snapshots: ProgressSnapshotData[]): number {
  const rev = [...snapshots].reverse()
  const idx = rev.findIndex(s => s.isDeloadWeek)
  return idx === -1 ? snapshots.length : idx
}

export function shouldDeload(
  snapshots:           ProgressSnapshotData[],
  avgReadinessScore:   number,
): DeloadDecision {
  const weeksSince = countWeeksSinceLastDeload(snapshots)

  if (weeksSince >= 8) {
    return {
      shouldDeload:         true,
      reason:               `${weeksSince} consecutive weeks of training — scheduled deload`,
      urgency:              'high',
      weeksSinceLastDeload: weeksSince,
    }
  }

  if (weeksSince >= 4 && avgReadinessScore < 52) {
    return {
      shouldDeload:         true,
      reason:               'Accumulated fatigue detected — proactive deload',
      urgency:              'medium',
      weeksSinceLastDeload: weeksSince,
    }
  }

  return { shouldDeload: false, weeksSinceLastDeload: weeksSince }
}
