import { HealthEngine }         from '../health/health.engine'
import { RecommendationEngine } from '../recommendation/recommendation.engine'
import { ProgressEngine }       from '../progress/progress.engine'
import { NotificationEngine }   from '../notification/notification.engine'
import { GamificationEngine }   from '../gamification/gamification.engine'
import { WorkoutEngine }        from '../workout/workout.engine'
import type { CoachContext, CoachReport } from './coach.types'
import type { ReadinessScore }            from '../health/health.types'
import type { ProgressAnalysis }          from '../progress/progress.types'
import type { NutritionAdjustment }       from '../recommendation/recommendation.types'

export class CoachEngine {
  private readonly health         = new HealthEngine()
  private readonly recommendation = new RecommendationEngine()
  private readonly progress       = new ProgressEngine()
  private readonly notification   = new NotificationEngine()
  private readonly workout        = new WorkoutEngine()
  readonly gamification           = new GamificationEngine()

  generateReport(ctx: CoachContext): CoachReport {
    const readiness               = this.health.calculateReadiness(ctx.latestHealthLog)
    const progressAnalysis        = this.progress.analyze(ctx)
    const nutritionRecommendation = this.recommendation.adjustNutrition(ctx, progressAnalysis)
    const trainingRecommendation  = this.recommendation.adjustTraining(ctx, readiness, progressAnalysis)
    const routineRecommendation   = this.workout.generate(ctx.profile, trainingRecommendation)
    const notifications           = this.notification.generate(ctx, progressAnalysis, readiness)
    const summary                 = this.buildSummary(readiness, progressAnalysis, nutritionRecommendation)

    return {
      readiness,
      progressAnalysis,
      nutritionRecommendation,
      trainingRecommendation,
      routineRecommendation,
      notifications,
      summary,
      xpEarned: 0,  // filled by gamification.service after persistence
    }
  }

  private buildSummary(
    readiness:  ReadinessScore,
    progress:   ProgressAnalysis,
    nutrition:  NutritionAdjustment,
  ): string {
    const lines: string[] = ['## Weekly Coach Report']
    lines.push(`**Readiness:** ${readiness.score}/100 — ${readiness.recommendation}`)

    if (progress.weightPlateau.detected) {
      lines.push(`**⚠️ Plateau:** ${progress.weightPlateau.recommendation}`)
    }
    if (progress.deloadDecision.shouldDeload) {
      lines.push(`**🔄 Deload:** ${progress.deloadDecision.reason}`)
    }
    if (progress.goalPrediction.canPredict) {
      lines.push(`**🎯 Goal ETA:** ${progress.goalPrediction.weeksRemaining} weeks (${progress.goalPrediction.estimatedDate})`)
    }

    const calDelta = nutrition.changes.calories
    if (Math.abs(calDelta) >= 50) {
      lines.push(`**🍽️ Calories:** ${calDelta > 0 ? '↑' : '↓'}${Math.abs(calDelta)} kcal → ${nutrition.targets.calories} kcal`)
    }

    lines.push(`**Adherence:** ${Math.round(progress.adherenceRate * 100)}%`)

    return lines.join('\n')
  }
}
