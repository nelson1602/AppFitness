import type { FitnessLevel, VolumeGuidelines, TrainingAdjustment } from './recommendation.types'

const VOLUME_GUIDELINES: Record<FitnessLevel, VolumeGuidelines> = {
  beginner:     { mev: 10, mav: 15, mrv: 18 },
  intermediate: { mev: 12, mav: 18, mrv: 22 },
  advanced:     { mev: 15, mav: 20, mrv: 25 },
}

export function adjustTrainingVolume(
  fitnessLevel:            FitnessLevel,
  trainingDaysPerWeek:     number,
  readinessScore:          number,
  isDeloadWeek:            boolean,
  weeksWithoutProgress:    number,
): TrainingAdjustment {
  const rationale: string[] = []

  if (isDeloadWeek) {
    rationale.push('Deload week: volume and intensity reduced 40%')
    return {
      recommendedFrequency: Math.max(2, trainingDaysPerWeek - 1),
      volumeModifier:       0.60,
      intensityModifier:    0.60,
      isDeloadWeek:         true,
      rationale,
    }
  }

  let volumeModifier    = 1.00
  let intensityModifier = 1.00

  if (readinessScore < 45) {
    volumeModifier    = 0.70
    intensityModifier = 0.80
    rationale.push('Low readiness — significant volume reduction for recovery')
  } else if (readinessScore < 60) {
    volumeModifier    = 0.85
    intensityModifier = 0.90
    rationale.push('Below-average readiness — moderate volume reduction')
  } else if (readinessScore >= 80 && weeksWithoutProgress >= 2) {
    volumeModifier = 1.10
    rationale.push('Plateau + good readiness — progressive overload applied')
  } else if (readinessScore >= 85) {
    volumeModifier = 1.05
    rationale.push('High readiness — slight volume increase')
  } else {
    rationale.push('Current training volume maintained')
  }

  const guidelines = VOLUME_GUIDELINES[fitnessLevel] ?? VOLUME_GUIDELINES.intermediate
  void guidelines  // available for future clamping logic

  return {
    recommendedFrequency: trainingDaysPerWeek,
    volumeModifier:       Math.round(volumeModifier * 100) / 100,
    intensityModifier:    Math.round(intensityModifier * 100) / 100,
    isDeloadWeek:         false,
    rationale,
  }
}
