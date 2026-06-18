import { calculateTDEE, adjustCalories, getTDEEInput } from './calorie.adjuster'
import { calculateMacros }                             from './macro.adjuster'
import { adjustTrainingVolume }                        from './volume.adjuster'
import type { CoachContext }                           from '../coach/coach.types'
import type { ReadinessScore }                         from '../health/health.types'
import type { ProgressAnalysis }                       from '../progress/progress.types'
import type {
  NutritionAdjustment, TrainingAdjustment,
  MacroTargets, PrimaryGoal, FitnessLevel,
} from './recommendation.types'

export class RecommendationEngine {
  adjustNutrition(
    ctx:      CoachContext,
    progress: ProgressAnalysis,
  ): NutritionAdjustment {
    const goal  = (ctx.profile.primaryGoal as PrimaryGoal) ?? 'maintain'
    const input = getTDEEInput(ctx.profile, ctx.currentWeightKg)
    const tdee  = calculateTDEE(input)

    const { calories, rationale } = adjustCalories(
      tdee,
      goal,
      progress.weeklyWeightChange,
      progress.adherenceRate,
    )

    const targets: MacroTargets = calculateMacros(calories, ctx.currentWeightKg, goal)

    const previous: MacroTargets = {
      calories: ctx.currentTargets.targetCalories  ?? tdee,
      proteinG: ctx.currentTargets.targetProteinG  ?? targets.proteinG,
      carbsG:   ctx.currentTargets.targetCarbsG    ?? targets.carbsG,
      fatG:     ctx.currentTargets.targetFatG      ?? targets.fatG,
    }

    return {
      targets,
      previous,
      tdee,
      rationale,
      changes: {
        calories: targets.calories  - previous.calories,
        protein:  targets.proteinG  - previous.proteinG,
        carbs:    targets.carbsG    - previous.carbsG,
        fat:      targets.fatG      - previous.fatG,
      },
    }
  }

  adjustTraining(
    ctx:       CoachContext,
    readiness: ReadinessScore,
    progress:  ProgressAnalysis,
  ): TrainingAdjustment {
    const level               = (ctx.profile.fitnessLevel as FitnessLevel) ?? 'intermediate'
    const weeksWithoutProgress = progress.weightPlateau.detected
      ? (progress.weightPlateau.durationWeeks ?? 0)
      : 0

    return adjustTrainingVolume(
      level,
      ctx.profile.trainingDaysPerWeek,
      readiness.score,
      progress.deloadDecision.shouldDeload,
      weeksWithoutProgress,
    )
  }
}
