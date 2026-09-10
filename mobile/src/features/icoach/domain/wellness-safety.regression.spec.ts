import { evaluate } from './engine';
import { ENGINE_RULE_VERSION, PROGRESS_SNAPSHOT_RULE_VERSION } from './rule-versions';
import { analyzeRestrictions, BODY_AREA_EXCLUSIONS } from './restrictions';
import { planTraining } from './training';
import type { CoachAssessment, EngineInput } from './types';

/**
 * ADR-P031 W-4B, group **J** (tests J38 … J40; J41 lives in
 * `progress-analysis.spec.ts`, next to the code it constrains).
 *
 * The three `BASELINE_*` objects are the assessments produced by the **real**
 * sources at `6946aaee71417c0afd312bc3b1262542afcbe67c` — the commit W-4B was
 * cut from — captured by running that revision's engine, not by re-serializing
 * today's. They are frozen here so the claim "W-4B changes nothing but the
 * version" is checked against evidence rather than restated.
 *
 * The expected values are compared **field by field**, with `ruleVersion`
 * substituted: an assessment computed now cannot be byte-identical to one
 * computed at the baseline, because V-2 deliberately moves
 * `ENGINE_RULE_VERSION` to `icoach-rules@1.2.0`. Everything else must match
 * exactly, and no wellness input is supplied — which is the production shape
 * (see `wellness-safety.dormancy.spec.ts`).
 */

const BASELINE_ABSENT = {
  ruleVersion: 'icoach-rules@1.1.0',
  bodyComposition: {
    bmi: 24.7,
    bmiCategory: 'NORMAL',
    leanBodyMassKg: 64,
    leanBodyMassMethod: 'BODY_FAT',
    bodyFatCategory: 'AVERAGE',
  },
  metabolics: {
    bmr: 1752,
    bmrMethod: 'KATCH_MCARDLE',
    activityMultiplier: 1.55,
    tdee: 2716,
  },
  nutrition: {
    calories: 2173,
    adjustmentPct: -20,
    proteinG: 160,
    fatG: 60,
    carbsG: 248,
    safetyFloorApplied: false,
  },
  training: {
    blocked: false,
    requiresMedicalClearance: false,
    intensity: 'MODERATE',
    rpeCap: 8,
    daysPerWeek: 4,
    excludedMovements: [],
  },
  recommendations: [
    {
      id: 'NUTRITION:calorie_target',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Daily target: 2173 kcal',
      explanation:
        'Based on a TDEE of 2716 kcal (KATCH_MCARDLE BMR × 1.55) adjusted -20% for your FAT_LOSS goal.',
      scientificBasis: 'Katch-McArdle (measured lean mass) + standard activity multipliers.',
      inputs: {
        tdee: 2716,
        bmr: 1752,
        adjustmentPct: -20,
        safetyFloorApplied: false,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'NUTRITION:macro_targets',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Macros: 160g protein / 248g carbs / 60g fat',
      explanation:
        'Protein is set per kg of body weight for your FAT_LOSS goal; fat covers hormonal needs; carbs fill the remaining calories.',
      scientificBasis: 'ISSN position stands on protein and macronutrient distribution.',
      inputs: {
        proteinG: 160,
        carbsG: 248,
        fatG: 60,
        weightKg: 80,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'TRAINING:intensity_plan',
      category: 'TRAINING',
      priority: 'MEDIUM',
      title: 'Train 4×/week at MODERATE intensity (RPE ≤ 8)',
      explanation:
        'Based on your INTERMEDIATE level and FAT_LOSS goal, adjusted for recent recovery.',
      scientificBasis: 'Progressive overload with autoregulation (RPE-based intensity capping).',
      inputs: {
        fitnessLevel: 'INTERMEDIATE',
        goal: 'FAT_LOSS',
        intensity: 'MODERATE',
        daysPerWeek: 4,
        cappedByRestrictions: false,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
  ],
} as unknown as CoachAssessment;

const BASELINE_STAGE1 = {
  ruleVersion: 'icoach-rules@1.1.0',
  bodyComposition: {
    bmi: 24.7,
    bmiCategory: 'NORMAL',
    leanBodyMassKg: 64,
    leanBodyMassMethod: 'BODY_FAT',
    bodyFatCategory: 'AVERAGE',
  },
  metabolics: {
    bmr: 1752,
    bmrMethod: 'KATCH_MCARDLE',
    activityMultiplier: 1.55,
    tdee: 2716,
  },
  nutrition: {
    calories: 2173,
    adjustmentPct: -20,
    proteinG: 160,
    fatG: 60,
    carbsG: 248,
    safetyFloorApplied: false,
  },
  training: {
    blocked: false,
    requiresMedicalClearance: false,
    intensity: 'MODERATE',
    rpeCap: 8,
    daysPerWeek: 4,
    excludedMovements: ['max_effort_lifts', 'valsalva_heavy_lifts'],
  },
  recommendations: [
    {
      id: 'SAFETY:movement_exclusions',
      category: 'SAFETY',
      priority: 'HIGH',
      title: 'Movements excluded by your restrictions',
      explanation:
        'While your restrictions are active, avoid: max_effort_lifts, valsalva_heavy_lifts.',
      scientificBasis: 'Load management for injured/restricted areas.',
      inputs: {
        excluded: 'max_effort_lifts,valsalva_heavy_lifts',
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'NUTRITION:calorie_target',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Daily target: 2173 kcal',
      explanation:
        'Based on a TDEE of 2716 kcal (KATCH_MCARDLE BMR × 1.55) adjusted -20% for your FAT_LOSS goal.',
      scientificBasis: 'Katch-McArdle (measured lean mass) + standard activity multipliers.',
      inputs: {
        tdee: 2716,
        bmr: 1752,
        adjustmentPct: -20,
        safetyFloorApplied: false,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'NUTRITION:macro_targets',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Macros: 160g protein / 248g carbs / 60g fat',
      explanation:
        'Protein is set per kg of body weight for your FAT_LOSS goal; fat covers hormonal needs; carbs fill the remaining calories.',
      scientificBasis: 'ISSN position stands on protein and macronutrient distribution.',
      inputs: {
        proteinG: 160,
        carbsG: 248,
        fatG: 60,
        weightKg: 80,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'TRAINING:intensity_plan',
      category: 'TRAINING',
      priority: 'MEDIUM',
      title: 'Train 4×/week at MODERATE intensity (RPE ≤ 8)',
      explanation:
        'Based on your INTERMEDIATE level and FAT_LOSS goal, capped by your medical restrictions, adjusted for recent recovery.',
      scientificBasis: 'Progressive overload with autoregulation (RPE-based intensity capping).',
      inputs: {
        fitnessLevel: 'INTERMEDIATE',
        goal: 'FAT_LOSS',
        intensity: 'MODERATE',
        daysPerWeek: 4,
        cappedByRestrictions: true,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
  ],
} as unknown as CoachAssessment;

const BASELINE_RESTRICTED = {
  ruleVersion: 'icoach-rules@1.1.0',
  bodyComposition: {
    bmi: 24.7,
    bmiCategory: 'NORMAL',
    leanBodyMassKg: 64,
    leanBodyMassMethod: 'BODY_FAT',
    bodyFatCategory: 'AVERAGE',
  },
  metabolics: {
    bmr: 1752,
    bmrMethod: 'KATCH_MCARDLE',
    activityMultiplier: 1.55,
    tdee: 2716,
  },
  nutrition: {
    calories: 2173,
    adjustmentPct: -20,
    proteinG: 160,
    fatG: 60,
    carbsG: 248,
    safetyFloorApplied: false,
  },
  training: {
    blocked: false,
    requiresMedicalClearance: true,
    intensity: 'MODERATE',
    rpeCap: 8,
    daysPerWeek: 4,
    excludedMovements: [
      'behind_neck_press',
      'deep_squat',
      'dips',
      'high_impact_cardio',
      'jumping',
      'lunge',
      'overhead_press',
    ],
  },
  recommendations: [
    {
      id: 'SAFETY:medical_clearance',
      category: 'SAFETY',
      priority: 'HIGH',
      title: 'Get medical clearance before increasing intensity',
      explanation:
        'A doctor restriction, severe restriction, or elevated blood pressure limits your plan to low intensity until a professional clears more.',
      scientificBasis: 'ACSM pre-participation screening; safety overrides performance goals.',
      inputs: {
        restrictionCount: 2,
        triggeredRules:
          'moderate_injury_cap,exclusions_knee,doctor_restriction_clearance,exclusions_shoulder',
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'SAFETY:movement_exclusions',
      category: 'SAFETY',
      priority: 'HIGH',
      title: 'Movements excluded by your restrictions',
      explanation:
        'While your restrictions are active, avoid: behind_neck_press, deep_squat, dips, high_impact_cardio, jumping, lunge, overhead_press.',
      scientificBasis: 'Load management for injured/restricted areas.',
      inputs: {
        excluded:
          'behind_neck_press,deep_squat,dips,high_impact_cardio,jumping,lunge,overhead_press',
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'NUTRITION:calorie_target',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Daily target: 2173 kcal',
      explanation:
        'Based on a TDEE of 2716 kcal (KATCH_MCARDLE BMR × 1.55) adjusted -20% for your FAT_LOSS goal.',
      scientificBasis: 'Katch-McArdle (measured lean mass) + standard activity multipliers.',
      inputs: {
        tdee: 2716,
        bmr: 1752,
        adjustmentPct: -20,
        safetyFloorApplied: false,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'NUTRITION:macro_targets',
      category: 'NUTRITION',
      priority: 'MEDIUM',
      title: 'Macros: 160g protein / 248g carbs / 60g fat',
      explanation:
        'Protein is set per kg of body weight for your FAT_LOSS goal; fat covers hormonal needs; carbs fill the remaining calories.',
      scientificBasis: 'ISSN position stands on protein and macronutrient distribution.',
      inputs: {
        proteinG: 160,
        carbsG: 248,
        fatG: 60,
        weightKg: 80,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
    {
      id: 'TRAINING:intensity_plan',
      category: 'TRAINING',
      priority: 'MEDIUM',
      title: 'Train 4×/week at MODERATE intensity (RPE ≤ 8)',
      explanation:
        'Based on your ADVANCED level and FAT_LOSS goal, capped by your medical restrictions, adjusted for recent recovery.',
      scientificBasis: 'Progressive overload with autoregulation (RPE-based intensity capping).',
      inputs: {
        fitnessLevel: 'ADVANCED',
        goal: 'FAT_LOSS',
        intensity: 'MODERATE',
        daysPerWeek: 4,
        cappedByRestrictions: true,
      },
      ruleVersion: 'icoach-rules@1.1.0',
    },
  ],
} as unknown as CoachAssessment;

const BASELINE_VERSION = 'icoach-rules@1.1.0';

/** The baseline with every version stamp moved to the current one, and nothing else. */
const atCurrentVersion = (baseline: CoachAssessment): CoachAssessment => ({
  ...baseline,
  ruleVersion: ENGINE_RULE_VERSION,
  recommendations: baseline.recommendations.map((rec) => ({
    ...rec,
    ruleVersion: ENGINE_RULE_VERSION,
  })),
});

const baseInput = (): EngineInput => ({
  subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
  activityLevel: 'MODERATE',
  goal: 'FAT_LOSS',
  fitnessLevel: 'INTERMEDIATE',
  restrictions: [],
  recovery: { sleepHours: 7.5, stressLevel: 2 },
  trainingDaysPreference: 4,
});

const SCENARIOS: readonly [string, EngineInput, CoachAssessment][] = [
  ['no profile, no restrictions', baseInput(), BASELINE_ABSENT],
  [
    'stage-1 blood pressure (the dormant medical exclusion path)',
    { ...baseInput(), bloodPressure: { systolic: 145, diastolic: 92 } },
    BASELINE_STAGE1,
  ],
  [
    'knee + doctor restrictions (clearance and area exclusions)',
    {
      ...baseInput(),
      fitnessLevel: 'ADVANCED',
      restrictions: [
        { type: 'INJURY', severity: 'MODERATE', bodyArea: 'knee' },
        { type: 'DOCTOR_RESTRICTION', severity: 'MILD', bodyArea: 'shoulder' },
      ],
    },
    BASELINE_RESTRICTED,
  ],
];

describe('W-4B regression against the 6946aae baseline (ADR-P031)', () => {
  it.each(SCENARIOS)('J38: %s is unchanged except for ruleVersion', (_name, input, baseline) => {
    const assessment = evaluate(input);
    const expected = atCurrentVersion(baseline);

    // Field by field, so a failure names the field that moved.
    expect(assessment.bodyComposition).toEqual(expected.bodyComposition);
    expect(assessment.metabolics).toEqual(expected.metabolics);
    expect(assessment.nutrition).toEqual(expected.nutrition);
    expect(assessment.training).toEqual(expected.training);
    expect(assessment.recommendations.map((rec) => rec.id)).toEqual(
      expected.recommendations.map((rec) => rec.id),
    );
    for (const [index, rec] of assessment.recommendations.entries()) {
      expect(rec).toEqual(expected.recommendations[index]);
    }
    expect(Object.keys(assessment).sort()).toEqual(Object.keys(baseline).sort());

    // And the one intended difference, in both places it is stamped.
    expect(baseline.ruleVersion).toBe(BASELINE_VERSION);
    expect(assessment.ruleVersion).toBe('icoach-rules@1.2.0');
    expect(assessment.recommendations.every((rec) => rec.ruleVersion === ENGINE_RULE_VERSION)).toBe(
      true,
    );
  });

  it('J38: the added planTraining parameter defaults to the pre-W-4B call', () => {
    const analysis = analyzeRestrictions(
      [{ type: 'INJURY', severity: 'MODERATE', bodyArea: 'knee' }],
      undefined,
    );

    // Five arguments — the exact pre-W-4B call site — must equal the six-argument
    // call with an empty declaration, so the seam is inert by construction.
    const oldShape = planTraining('INTERMEDIATE', 'FAT_LOSS', analysis, undefined, 4);
    const newShape = planTraining('INTERMEDIATE', 'FAT_LOSS', analysis, undefined, 4, []);
    expect(newShape).toEqual(oldShape);

    // Declared movements only ADD, and the union stays sorted and de-duplicated.
    const declaring = planTraining('INTERMEDIATE', 'FAT_LOSS', analysis, undefined, 4, [
      'bridging',
      'deep_squat',
      'bridging',
    ]);
    expect(declaring.excludedMovements).toEqual(
      [...new Set([...oldShape.excludedMovements, 'bridging', 'deep_squat'])].sort(),
    );
    expect({ ...declaring, excludedMovements: [] }).toEqual({
      ...oldShape,
      excludedMovements: [],
    });
  });

  it('J39: medical dormancy holds — the analyzer imports nothing medical', () => {
    // The mapping table is unchanged, byte for byte, and still keyed by body
    // area — W-4B neither reads it nor extends it.
    expect(BODY_AREA_EXCLUSIONS).toEqual({
      knee: ['jumping', 'deep_squat', 'lunge', 'high_impact_cardio'],
      shoulder: ['overhead_press', 'behind_neck_press', 'dips'],
      back: ['heavy_hinge', 'loaded_spinal_flexion', 'good_morning'],
      lower_back: ['heavy_hinge', 'loaded_spinal_flexion', 'good_morning'],
      hip: ['deep_squat', 'high_impact_cardio', 'sprinting'],
      ankle: ['jumping', 'running', 'high_impact_cardio'],
      wrist: ['heavy_pressing', 'front_rack_loading'],
      elbow: ['heavy_pressing', 'skull_crushers'],
      neck: ['overhead_press', 'loaded_carries', 'bridging'],
    });

    // Unreachable in public v1: with no restrictions there is no medical
    // exclusion, no clearance and no cap, whatever the user declares.
    const declaring = evaluate({
      ...baseInput(),
      wellness: {
        evaluationCompleted: true,
        evaluationDate: '2026-01-15',
        affectedAreas: ['knee', 'shoulder', 'lower_back'],
        movementsToAvoid: ['deep_squat', 'overhead_press'],
      },
    });
    expect(analyzeRestrictions([], undefined)).toEqual({
      blocked: false,
      requiresMedicalClearance: false,
      intensityCap: null,
      excludedMovements: [],
      triggeredRules: [],
    });
    expect(declaring.training.requiresMedicalClearance).toBe(false);
    expect(declaring.training.blocked).toBe(false);
    expect(declaring.recommendations.map((rec) => rec.id)).not.toContain(
      'SAFETY:movement_exclusions',
    );

    // A declared AREA still maps to nothing, even though the medical table has
    // an entry for the same word: the two vocabularies are not connected.
    expect(BODY_AREA_EXCLUSIONS.knee).toBeDefined();
    expect(declaring.training.excludedMovements).toEqual(['deep_squat', 'overhead_press']);
  });

  it('J40: nutrition is identical for a declaring user (Decision 13)', () => {
    const plain = evaluate(baseInput());
    const declaring = evaluate({
      ...baseInput(),
      wellness: {
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: [],
        movementsToAvoid: ['deep_squat', 'jumping', 'running'],
      },
    });

    expect(declaring.nutrition).toEqual(plain.nutrition);
    expect(declaring.nutrition).toEqual(BASELINE_ABSENT.nutrition);

    const nutritionRecs = (assessment: CoachAssessment) =>
      assessment.recommendations.filter((rec) => rec.category === 'NUTRITION');
    expect(nutritionRecs(declaring)).toEqual(nutritionRecs(plain));
    expect(nutritionRecs(declaring)).toHaveLength(2);

    // The snapshot version is a separate family and is untouched by any of this.
    expect(PROGRESS_SNAPSHOT_RULE_VERSION).toBe(BASELINE_VERSION);
  });
});
