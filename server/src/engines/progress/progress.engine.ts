import { detectWeightPlateau }                    from './plateau.detector'
import { predictGoalDate }                         from './goal.predictor'
import { shouldDeload, countWeeksSinceLastDeload } from './deload.scheduler'
import type { CoachContext }                       from '../coach/coach.types'
import type { ProgressAnalysis }                   from './progress.types'

export class ProgressEngine {
  analyze(ctx: CoachContext): ProgressAnalysis {
    const goal      = ctx.profile.primaryGoal ?? 'maintain'
    const snapshots = ctx.progressSnapshots

    const weightPlateau  = detectWeightPlateau(snapshots, goal)
    const goalPrediction = predictGoalDate(ctx.recentWeights, ctx.profile.targetWeightKg, goal)

    // Use latest health log readiness as a proxy; default 65 if no data
    const avgReadiness    = ctx.latestHealthLog ? 65 : 65
    const deloadDecision  = shouldDeload(snapshots, avgReadiness)
    const weeksSinceLastDeload = countWeeksSinceLastDeload(snapshots)

    // Weekly weight change: compare latest two body-weight entries
    const sorted = [...ctx.recentWeights].sort((a, b) => a.date.localeCompare(b.date))
    const weeklyWeightChange =
      sorted.length >= 2
        ? sorted[sorted.length - 1].weight - sorted[sorted.length - 2].weight
        : 0

    // Volume change: last two snapshots
    const last2 = snapshots.slice(-2)
    const weeklyVolumeChange =
      last2.length === 2 && last2[0].totalVolumeKg && last2[1].totalVolumeKg
        ? ((last2[1].totalVolumeKg - last2[0].totalVolumeKg) / last2[0].totalVolumeKg) * 100
        : 0

    // Adherence: actual training days vs target (current week)
    const adherenceRate =
      ctx.profile.trainingDaysPerWeek > 0
        ? Math.min(1, ctx.trainingDaysActual / ctx.profile.trainingDaysPerWeek)
        : 0.75

    return {
      weightPlateau,
      goalPrediction,
      deloadDecision,
      weeklyWeightChange,
      weeklyVolumeChange:   Math.round(weeklyVolumeChange * 10) / 10,
      adherenceRate:        Math.round(adherenceRate * 100) / 100,
      weeksSinceLastDeload,
    }
  }
}
