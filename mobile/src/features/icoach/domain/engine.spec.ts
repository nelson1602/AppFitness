import {
  WELLNESS_MOVEMENTS_TO_AVOID,
  type WellnessMovementToAvoid,
} from '@/features/wellness/domain/wellness-safety-profile';

import { evaluate, validateEngineInput } from './engine';
import { ENGINE_RULE_VERSION } from './rule-versions';
import type { EngineInput } from './types';
import { InvalidEngineInputError } from './types';
import {
  analyzeWellnessSafety,
  WELLNESS_REASON_MOVEMENT_DECLARED,
  WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
  WellnessSafetyInputInvalid,
} from './wellness-safety';

const baseInput = (): EngineInput => ({
  subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
  activityLevel: 'MODERATE',
  goal: 'FAT_LOSS',
  fitnessLevel: 'INTERMEDIATE',
  restrictions: [],
  recovery: { sleepHours: 7.5, stressLevel: 2 },
  trainingDaysPreference: 4,
});

describe('iCoach engine', () => {
  it('DETERMINISM: identical inputs produce byte-identical assessments', () => {
    const a = evaluate(baseInput());
    const b = evaluate(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    // Repeatable across many runs — no hidden state.
    const first = JSON.stringify(evaluate(baseInput()));
    for (let i = 0; i < 25; i += 1) {
      expect(JSON.stringify(evaluate(baseInput()))).toBe(first);
    }
  });

  it('produces a complete, versioned, explainable assessment', () => {
    const assessment = evaluate(baseInput());

    expect(assessment.ruleVersion).toBe(ENGINE_RULE_VERSION);
    expect(assessment.bodyComposition.bmi).toBe(24.7);
    expect(assessment.metabolics.bmrMethod).toBe('KATCH_MCARDLE');
    expect(assessment.nutrition.calories).toBeGreaterThan(0);
    expect(assessment.training.daysPerWeek).toBe(4);

    for (const rec of assessment.recommendations) {
      expect(rec.id).toMatch(/^[A-Z]+:[a-z0-9_]+$/); // deterministic ids
      expect(rec.ruleVersion).toBe(ENGINE_RULE_VERSION);
      expect(rec.explanation.length).toBeGreaterThan(0);
      expect(rec.scientificBasis.length).toBeGreaterThan(0);
      expect(Object.keys(rec.inputs).length).toBeGreaterThan(0);
    }
  });

  it('GOAL BEHAVIOR: goals change calories/macros deterministically', () => {
    const fatLoss = evaluate({ ...baseInput(), goal: 'FAT_LOSS' });
    const muscleGain = evaluate({ ...baseInput(), goal: 'MUSCLE_GAIN' });
    const maintenance = evaluate({ ...baseInput(), goal: 'MAINTENANCE' });

    expect(fatLoss.nutrition.calories).toBeLessThan(maintenance.nutrition.calories);
    expect(muscleGain.nutrition.calories).toBeGreaterThan(maintenance.nutrition.calories);
    expect(fatLoss.nutrition.proteinG).toBeGreaterThan(muscleGain.nutrition.proteinG);
  });

  it('MEDICAL OVERRIDE: restrictions beat goal optimization end-to-end', () => {
    const input: EngineInput = {
      ...baseInput(),
      fitnessLevel: 'ADVANCED',
      goal: 'STRENGTH',
      restrictions: [{ type: 'DOCTOR_RESTRICTION', severity: 'SEVERE', bodyArea: 'back' }],
    };
    const assessment = evaluate(input);

    expect(assessment.training.intensity).toBe('LOW');
    expect(assessment.training.requiresMedicalClearance).toBe(true);
    expect(assessment.training.excludedMovements).toContain('heavy_hinge');
    expect(
      assessment.recommendations.some(
        (r) => r.id === 'SAFETY:medical_clearance' && r.priority === 'HIGH',
      ),
    ).toBe(true);
  });

  it('MEDICAL OVERRIDE: crisis blood pressure blocks training with a CRITICAL rec', () => {
    const assessment = evaluate({
      ...baseInput(),
      bloodPressure: { systolic: 185, diastolic: 112 },
    });

    expect(assessment.training.blocked).toBe(true);
    expect(assessment.training.daysPerWeek).toBe(0);
    const rec = assessment.recommendations.find((r) => r.id === 'SAFETY:bp_crisis_block');
    expect(rec?.priority).toBe('CRITICAL');
    // No training recommendation when blocked:
    expect(assessment.recommendations.some((r) => r.id === 'TRAINING:intensity_plan')).toBe(false);
  });

  it('SAFETY: underweight + fat-loss yields a CRITICAL warning and calorie floor', () => {
    const assessment = evaluate({
      ...baseInput(),
      subject: { age: 25, sex: 'FEMALE', heightCm: 170, weightKg: 50 },
      activityLevel: 'SEDENTARY',
      goal: 'FAT_LOSS',
    });

    expect(assessment.bodyComposition.bmiCategory).toBe('UNDERWEIGHT');
    expect(
      assessment.recommendations.some(
        (r) => r.id === 'BODY:underweight_fat_loss_warning' && r.priority === 'CRITICAL',
      ),
    ).toBe(true);
    expect(assessment.nutrition.safetyFloorApplied).toBe(true);
    expect(assessment.nutrition.calories).toBeGreaterThanOrEqual(assessment.metabolics.bmr);
  });

  it('surfaces a recovery recommendation when sleep is short', () => {
    const assessment = evaluate({ ...baseInput(), recovery: { sleepHours: 5 } });
    expect(assessment.recommendations.some((r) => r.id === 'RECOVERY:low_sleep')).toBe(true);
    expect(assessment.training.intensity).toBe('LOW'); // MODERATE stepped down
  });

  it.each([
    ['age', { age: 12 }],
    ['age', { age: 121 }],
    ['age', { age: Number.NaN }],
    ['heightCm', { heightCm: 99 }],
    ['heightCm', { heightCm: 251 }],
    ['weightKg', { weightKg: 29 }],
    ['weightKg', { weightKg: 401 }],
    ['bodyFatPct', { bodyFatPct: 2 }],
    ['bodyFatPct', { bodyFatPct: 71 }],
  ])('INVALID INPUT: rejects out-of-range %s', (_field, subjectOverride) => {
    const input = baseInput();
    input.subject = { ...input.subject, ...subjectOverride };
    expect(() => evaluate(input)).toThrow(InvalidEngineInputError);
  });

  it('INVALID INPUT: rejects impossible blood pressure and day preferences', () => {
    expect(() =>
      validateEngineInput({ ...baseInput(), bloodPressure: { systolic: 500, diastolic: 80 } }),
    ).toThrow(InvalidEngineInputError);
    expect(() =>
      validateEngineInput({ ...baseInput(), bloodPressure: { systolic: 120, diastolic: 10 } }),
    ).toThrow(InvalidEngineInputError);
    expect(() => validateEngineInput({ ...baseInput(), trainingDaysPreference: 9 })).toThrow(
      InvalidEngineInputError,
    );
    expect(() => validateEngineInput({ ...baseInput(), trainingDaysPreference: 2.5 })).toThrow(
      InvalidEngineInputError,
    );
  });

  it('boundary values are accepted (13/120y, 100/250cm, 30/400kg, bf 3/70)', () => {
    for (const subject of [
      { age: 13, sex: 'MALE' as const, heightCm: 100, weightKg: 30 },
      { age: 120, sex: 'FEMALE' as const, heightCm: 250, weightKg: 400, bodyFatPct: 70 },
      { age: 30, sex: 'OTHER' as const, heightCm: 175, weightKg: 70, bodyFatPct: 3 },
    ]) {
      expect(() => evaluate({ ...baseInput(), subject })).not.toThrow();
    }
  });
  // ── ADR-P031 W-4B, group B (tests B9 … B11) ───────────────────────────────
  // The wellness seam is DORMANT: no production caller supplies
  // `EngineInput.wellness` (asserted by `wellness-safety.dormancy.spec.ts`).
  // These tests supply it directly, so the contract is pinned before the
  // W-4C/W-4D activation slice can rely on it.

  const declaring = (movements: readonly WellnessMovementToAvoid[]): EngineInput => ({
    ...baseInput(),
    wellness: {
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas: [],
      movementsToAvoid: movements,
    },
  });

  it('B9: declared movements only ADD exclusions — the rest of the plan is identical', () => {
    const without = evaluate(baseInput());
    const with_ = evaluate(declaring(['deep_squat', 'jumping', 'deep_squat']));

    // Sorted and de-duplicated, and exactly what was declared.
    expect(with_.training.excludedMovements).toEqual(['deep_squat', 'jumping']);
    expect(without.training.excludedMovements).toEqual([]);

    // Nothing else about the plan moves: a declaration never lowers intensity,
    // caps RPE, removes a training day, blocks training or demands clearance.
    expect(with_.training.blocked).toBe(without.training.blocked);
    expect(with_.training.requiresMedicalClearance).toBe(without.training.requiresMedicalClearance);
    expect(with_.training.intensity).toBe(without.training.intensity);
    expect(with_.training.rpeCap).toBe(without.training.rpeCap);
    expect(with_.training.daysPerWeek).toBe(without.training.daysPerWeek);

    // And the whole nutrition block is byte-identical (ADR-P031 Decision 13).
    expect(JSON.stringify(with_.nutrition)).toBe(JSON.stringify(without.nutrition));
    expect(JSON.stringify(with_.bodyComposition)).toBe(JSON.stringify(without.bodyComposition));
    expect(JSON.stringify(with_.metabolics)).toBe(JSON.stringify(without.metabolics));
  });

  it('B10: wellness data never triggers a medical recommendation', () => {
    const assessment = evaluate(declaring([...WELLNESS_MOVEMENTS_TO_AVOID]));
    const ids = assessment.recommendations.map((rec) => rec.id);

    // `restrictions: []` stays medically silent no matter what is declared.
    expect(ids).not.toContain('SAFETY:medical_clearance');
    expect(ids).not.toContain('SAFETY:bp_crisis_block');
    // The dormant medical exclusion rule does not fire either: a self-declared
    // movement is not a restriction, and the two paths stay separate.
    expect(ids).not.toContain('SAFETY:movement_exclusions');
    expect(assessment.training.requiresMedicalClearance).toBe(false);
    expect(assessment.training.blocked).toBe(false);
  });

  it('B11: the recommendation is explainable through identifiers, not raw tokens', () => {
    // Four declarations, deliberately supplied out of order and with a
    // duplicate, so the assertions below pin the COMPLETE deterministic set
    // rather than whatever happened to arrive first.
    const declared: WellnessMovementToAvoid[] = [
      'overhead_press',
      'dips',
      'bridging',
      'overhead_press',
    ];
    const assessment = evaluate(declaring(declared));
    const matching = assessment.recommendations.filter(
      (candidate) => candidate.id === WELLNESS_RULE_MOVEMENT_EXCLUSIONS,
    );
    // Exactly one wellness recommendation, however many movements exist.
    expect(matching).toHaveLength(1);
    const [rec] = matching;

    expect(rec.id).toBe('WELLNESS:movement_exclusions');
    expect(rec.category).toBe('SAFETY');
    expect(rec.ruleVersion).toBe(ENGINE_RULE_VERSION);
    expect(ENGINE_RULE_VERSION).toBe('icoach-rules@1.2.0');

    // Structured reason code, and the EXACT consumed inputs: the whole
    // validated set, de-duplicated and in the analyzer’s sorted order
    // (ADR-P031 Decision 10, `Recommendation.inputs` contract).
    expect(rec.inputs.reasonCode).toBe(WELLNESS_REASON_MOVEMENT_DECLARED);
    expect(rec.inputs.reasonCode).toBe('wellness.movement.declared');
    expect(rec.inputs.movements).toBe('bridging,dips,overhead_press');
    expect(String(rec.inputs.movements).split(',')).toEqual(assessment.training.excludedMovements);

    // No count: it is not a consumed input, and it is sensitive metadata
    // this rule has no need for.
    expect(Object.keys(rec.inputs).sort()).toEqual(['movements', 'reasonCode']);
    expect(rec.inputs).not.toHaveProperty('declaredMovementCount');

    // Every reason — not merely the first — carries the code, its validated
    // movement and the rule version that produced it.
    const analysis = analyzeWellnessSafety(declaring(declared).wellness);
    expect(analysis.reasons).toEqual([
      {
        code: 'wellness.movement.declared',
        inputs: { movement: 'bridging' },
        ruleVersion: ENGINE_RULE_VERSION,
      },
      {
        code: 'wellness.movement.declared',
        inputs: { movement: 'dips' },
        ruleVersion: ENGINE_RULE_VERSION,
      },
      {
        code: 'wellness.movement.declared',
        inputs: { movement: 'overhead_press' },
        ruleVersion: ENGINE_RULE_VERSION,
      },
    ]);
    expect(analysis.reasons.every((reason) => reason.ruleVersion === ENGINE_RULE_VERSION)).toBe(
      true,
    );
    expect(analysis.reasons.map((reason) => reason.inputs.movement)).toEqual(
      analysis.excludedMovements,
    );

    // Rendered copy is built from localization keys, so it carries no raw
    // token, no count and no medical vocabulary. Raw movements stay inside
    // `inputs` and the analyzer output — never in anything rendered.
    const copy = `${rec.title} ${rec.explanation} ${rec.scientificBasis}`;
    expect(WELLNESS_MOVEMENTS_TO_AVOID.filter((token) => copy.includes(token))).toEqual([]);
    expect(copy).not.toMatch(/\d/);
    expect(copy).not.toMatch(/injur|diagnos|medical|severity|clearance/i);
    for (const key of [rec.title, rec.explanation, rec.scientificBasis]) {
      expect(key).toMatch(/^wellness\.plan\.[A-Za-z]+$/);
    }
  });

  it('B11: an empty or absent wellness input emits no wellness recommendation', () => {
    for (const input of [baseInput(), declaring([])]) {
      const ids = evaluate(input).recommendations.map((rec) => rec.id);
      expect(ids).not.toContain(WELLNESS_RULE_MOVEMENT_EXCLUSIONS);
    }
  });

  it('B9: a malformed wellness input aborts the assessment, it is not swallowed', () => {
    // A fail-closed analyzer the engine caught would be no protection at all:
    // the refusal has to reach the caller so the surface can render the
    // canonical Error state (ADR-P031 Decision 8).
    const malformed = declaring(['not_a_movement'] as unknown as WellnessMovementToAvoid[]);
    expect(() => evaluate(malformed)).toThrow(WellnessSafetyInputInvalid);
    expect(() => evaluate(malformed)).toThrow('movementsToAvoid: unknown-token');

    // And no partial assessment leaks out on the way: the medically valid
    // parts of the same input still produce nothing.
    let assessment: unknown = 'not-assigned';
    try {
      assessment = evaluate(malformed);
    } catch {
      // expected
    }
    expect(assessment).toBe('not-assigned');
  });
});
