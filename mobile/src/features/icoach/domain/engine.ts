import { assessBodyComposition } from './body-composition';
import { assessMetabolics } from './metabolic';
import { planNutrition } from './nutrition';
import { analyzeRestrictions } from './restrictions';
import { ENGINE_RULE_VERSION } from './rule-versions';
import { planTraining } from './training';
import {
  CoachAssessment,
  EngineInput,
  InvalidEngineInputError,
  Recommendation,
} from './types';

/**
 * iCoach Deterministic Engine — orchestrator (.ai/07_ICOACH.md chain):
 * body composition → metabolics → nutrition → restrictions → training →
 * recommendations. Pure function: identical inputs always yield an
 * identical assessment. Every recommendation is explainable (rule id,
 * version, consumed inputs, scientific basis).
 */

export function validateEngineInput(input: EngineInput): void {
  const { subject } = input;
  if (!Number.isFinite(subject.age) || subject.age < 13 || subject.age > 120) {
    throw new InvalidEngineInputError('age', 'must be between 13 and 120');
  }
  if (!Number.isFinite(subject.heightCm) || subject.heightCm < 100 || subject.heightCm > 250) {
    throw new InvalidEngineInputError('heightCm', 'must be between 100 and 250');
  }
  if (!Number.isFinite(subject.weightKg) || subject.weightKg < 30 || subject.weightKg > 400) {
    throw new InvalidEngineInputError('weightKg', 'must be between 30 and 400');
  }
  if (
    subject.bodyFatPct !== undefined &&
    (!Number.isFinite(subject.bodyFatPct) || subject.bodyFatPct < 3 || subject.bodyFatPct > 70)
  ) {
    throw new InvalidEngineInputError('bodyFatPct', 'must be between 3 and 70');
  }
  if (input.bloodPressure) {
    const { systolic, diastolic } = input.bloodPressure;
    if (!Number.isFinite(systolic) || systolic < 40 || systolic > 300) {
      throw new InvalidEngineInputError('bloodPressure.systolic', 'must be between 40 and 300');
    }
    if (!Number.isFinite(diastolic) || diastolic < 20 || diastolic > 200) {
      throw new InvalidEngineInputError('bloodPressure.diastolic', 'must be between 20 and 200');
    }
  }
  if (
    input.trainingDaysPreference !== undefined &&
    (!Number.isInteger(input.trainingDaysPreference) ||
      input.trainingDaysPreference < 0 ||
      input.trainingDaysPreference > 7)
  ) {
    throw new InvalidEngineInputError('trainingDaysPreference', 'must be an integer 0–7');
  }
}

export function evaluate(input: EngineInput): CoachAssessment {
  validateEngineInput(input);

  const bodyComposition = assessBodyComposition(input.subject);
  const metabolics = assessMetabolics(input.subject, input.activityLevel);
  const nutrition = planNutrition(input.subject, metabolics, input.goal);
  const restrictionAnalysis = analyzeRestrictions(input.restrictions, input.bloodPressure);
  const training = planTraining(
    input.fitnessLevel,
    input.goal,
    restrictionAnalysis,
    input.recovery,
    input.trainingDaysPreference,
  );

  const recommendations: Recommendation[] = [];
  const add = (rec: Omit<Recommendation, 'ruleVersion'>): void => {
    recommendations.push({ ...rec, ruleVersion: ENGINE_RULE_VERSION });
  };

  // ── Safety (always first; medical safety overrides performance) ─────────────
  if (training.blocked) {
    add({
      id: 'SAFETY:bp_crisis_block',
      category: 'SAFETY',
      priority: 'CRITICAL',
      title: 'Do not train — seek medical clearance',
      explanation:
        'Your recorded blood pressure is in a range where exercise should not begin until a healthcare provider clears you.',
      scientificBasis: 'ACSM exercise pre-participation guidance (blood pressure ≥180/110).',
      inputs: {
        systolic: input.bloodPressure?.systolic ?? null,
        diastolic: input.bloodPressure?.diastolic ?? null,
      },
    });
  } else if (training.requiresMedicalClearance) {
    add({
      id: 'SAFETY:medical_clearance',
      category: 'SAFETY',
      priority: 'HIGH',
      title: 'Get medical clearance before increasing intensity',
      explanation:
        'A doctor restriction, severe restriction, or elevated blood pressure limits your plan to low intensity until a professional clears more.',
      scientificBasis: 'ACSM pre-participation screening; safety overrides performance goals.',
      inputs: {
        restrictionCount: input.restrictions.length,
        triggeredRules: restrictionAnalysis.triggeredRules.join(','),
      },
    });
  }
  if (training.excludedMovements.length > 0) {
    add({
      id: 'SAFETY:movement_exclusions',
      category: 'SAFETY',
      priority: 'HIGH',
      title: 'Movements excluded by your restrictions',
      explanation: `While your restrictions are active, avoid: ${training.excludedMovements.join(', ')}.`,
      scientificBasis: 'Load management for injured/restricted areas.',
      inputs: { excluded: training.excludedMovements.join(',') },
    });
  }

  // ── Nutrition ────────────────────────────────────────────────────────────────
  add({
    id: 'NUTRITION:calorie_target',
    category: 'NUTRITION',
    priority: 'MEDIUM',
    title: `Daily target: ${nutrition.calories} kcal`,
    explanation: nutrition.safetyFloorApplied
      ? `Your ${input.goal} goal implies a deficit, but the target was raised to a safe floor — eating below your BMR or clinical minimums is not recommended.`
      : `Based on a TDEE of ${metabolics.tdee} kcal (${metabolics.bmrMethod} BMR × ${metabolics.activityMultiplier}) adjusted ${nutrition.adjustmentPct}% for your ${input.goal} goal.`,
    scientificBasis:
      metabolics.bmrMethod === 'KATCH_MCARDLE'
        ? 'Katch-McArdle (measured lean mass) + standard activity multipliers.'
        : 'Mifflin-St Jeor (1990) + standard activity multipliers.',
    inputs: {
      tdee: metabolics.tdee,
      bmr: metabolics.bmr,
      adjustmentPct: nutrition.adjustmentPct,
      safetyFloorApplied: nutrition.safetyFloorApplied,
    },
  });
  add({
    id: 'NUTRITION:macro_targets',
    category: 'NUTRITION',
    priority: 'MEDIUM',
    title: `Macros: ${nutrition.proteinG}g protein / ${nutrition.carbsG}g carbs / ${nutrition.fatG}g fat`,
    explanation: `Protein is set per kg of body weight for your ${input.goal} goal; fat covers hormonal needs; carbs fill the remaining calories.`,
    scientificBasis: 'ISSN position stands on protein and macronutrient distribution.',
    inputs: {
      proteinG: nutrition.proteinG,
      carbsG: nutrition.carbsG,
      fatG: nutrition.fatG,
      weightKg: input.subject.weightKg,
    },
  });

  // ── Training ────────────────────────────────────────────────────────────────
  if (!training.blocked) {
    add({
      id: 'TRAINING:intensity_plan',
      category: 'TRAINING',
      priority: 'MEDIUM',
      title: `Train ${training.daysPerWeek}×/week at ${training.intensity} intensity (RPE ≤ ${training.rpeCap})`,
      explanation: `Based on your ${input.fitnessLevel} level and ${input.goal} goal${restrictionAnalysis.intensityCap ? ', capped by your medical restrictions' : ''}${input.recovery ? ', adjusted for recent recovery' : ''}.`,
      scientificBasis: 'Progressive overload with autoregulation (RPE-based intensity capping).',
      inputs: {
        fitnessLevel: input.fitnessLevel,
        goal: input.goal,
        intensity: training.intensity,
        daysPerWeek: training.daysPerWeek,
        cappedByRestrictions: restrictionAnalysis.intensityCap !== null,
      },
    });
  }

  // ── Recovery ────────────────────────────────────────────────────────────────
  if (input.recovery?.sleepHours !== undefined && input.recovery.sleepHours < 6) {
    add({
      id: 'RECOVERY:low_sleep',
      category: 'RECOVERY',
      priority: 'MEDIUM',
      title: 'Prioritize sleep',
      explanation: `Averaging ${input.recovery.sleepHours}h of sleep impairs recovery and performance; intensity was reduced accordingly.`,
      scientificBasis: 'Sleep restriction impairs recovery, glucose metabolism, and training adaptations.',
      inputs: { sleepHours: input.recovery.sleepHours },
    });
  }

  // ── Body composition context ────────────────────────────────────────────────
  if (bodyComposition.bmiCategory === 'UNDERWEIGHT' && input.goal === 'FAT_LOSS') {
    add({
      id: 'BODY:underweight_fat_loss_warning',
      category: 'SAFETY',
      priority: 'CRITICAL',
      title: 'Fat loss is not recommended at your current BMI',
      explanation: `Your BMI (${bodyComposition.bmi}) is in the underweight range — a caloric deficit could be harmful. Consult a healthcare provider about an appropriate goal.`,
      scientificBasis: 'WHO BMI classification; energy deficit contraindicated in underweight.',
      inputs: { bmi: bodyComposition.bmi, goal: input.goal },
    });
  }

  return {
    ruleVersion: ENGINE_RULE_VERSION,
    bodyComposition,
    metabolics,
    nutrition,
    training,
    recommendations,
  };
}
