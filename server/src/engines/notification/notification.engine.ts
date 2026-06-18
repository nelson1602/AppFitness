import {
  getReadinessMessage,
  getMotivationMessage,
  getPlateauMessage,
  getDeloadMessage,
  getLowProteinMessage,
} from './message.templates'
import type { CoachContext }          from '../coach/coach.types'
import type { ReadinessScore }        from '../health/health.types'
import type { ProgressAnalysis }      from '../progress/progress.types'
import type { NotificationPayload }   from './notification.types'

export class NotificationEngine {
  generate(
    ctx:      CoachContext,
    progress: ProgressAnalysis,
    readiness: ReadinessScore,
  ): NotificationPayload[] {
    const out: NotificationPayload[] = []

    // 1. Readiness
    out.push({
      type:    'insight',
      priority: readiness.score < 50 ? 'high' : 'low',
      title:    `Readiness: ${readiness.score}/100 — ${readiness.status}`,
      message:  getReadinessMessage(readiness),
    })

    // 2. Motivation / streak
    out.push({
      type:    'motivation',
      priority: 'low',
      title:   'Daily Check-in',
      message:  getMotivationMessage(ctx.stats.currentStreak, ctx.workoutCountThisWeek),
    })

    // 3. Weight plateau
    if (progress.weightPlateau.detected) {
      out.push({
        type:    'warning',
        priority: 'high',
        title:   'Progress Plateau Detected',
        message:  getPlateauMessage(ctx.profile.primaryGoal ?? 'maintain'),
        data:    { durationWeeks: progress.weightPlateau.durationWeeks },
      })
    }

    // 4. Deload
    if (progress.deloadDecision.shouldDeload) {
      out.push({
        type:    'insight',
        priority: progress.deloadDecision.urgency === 'high' ? 'high' : 'medium',
        title:   'Deload Week Recommended',
        message:  getDeloadMessage(progress.deloadDecision.reason ?? 'Accumulated fatigue'),
      })
    }

    // 5. Low protein
    const targetProtein = ctx.currentTargets.targetProteinG ?? 150
    if (ctx.recentProteinG > 0 && ctx.recentProteinG < targetProtein * 0.75) {
      out.push({
        type:    'warning',
        priority: 'medium',
        title:   'Protein Intake Below Target',
        message:  getLowProteinMessage(ctx.recentProteinG, targetProtein),
      })
    }

    // 6. Goal ETA
    if (progress.goalPrediction.canPredict && progress.goalPrediction.weeksRemaining != null) {
      out.push({
        type:    'insight',
        priority: 'low',
        title:   'Goal Timeline',
        message: `At your current rate you'll reach your goal in ~${progress.goalPrediction.weeksRemaining} weeks (${progress.goalPrediction.estimatedDate}).`,
        data:    { ...progress.goalPrediction },
      })
    }

    return out
  }
}
