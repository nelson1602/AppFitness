import { evaluate, validateEngineInput } from './engine';
import { ENGINE_RULE_VERSION } from './rule-versions';
import type { EngineInput } from './types';
import { InvalidEngineInputError } from './types';

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
      restrictions: [
        { type: 'DOCTOR_RESTRICTION', severity: 'SEVERE', bodyArea: 'back' },
      ],
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
});
