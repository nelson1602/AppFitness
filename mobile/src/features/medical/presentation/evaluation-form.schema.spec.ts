import {
  evaluationFormDefaults,
  evaluationFormSchema,
  toEvaluationInput,
  todayIso,
  type EvaluationFormOutput,
} from './evaluation-form.schema';

/**
 * The schema is the single validation source of truth for the evaluation
 * form; the adapter maps parsed output onto the domain EvaluationInput.
 * These cover the required fields, optional-blank handling (empty inputs
 * must not become NaN), numeric bounds, and free-text trimming/nulling.
 */

const valid = {
  evaluationDate: '2026-07-09',
  weightKg: '82',
  bodyFatPct: '',
  muscleMassKg: '',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  restingHeartRate: '',
  sleepQuality: '',
  stressLevel: '',
  activityLevel: undefined,
  doctorNotes: '',
  medicalConditions: '',
  medications: '',
};

describe('evaluationFormSchema', () => {
  it('accepts a minimal valid form (date + weight) and coerces weight to a number', () => {
    const result = evaluationFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightKg).toBe(82);
      expect(typeof result.data.weightKg).toBe('number');
      expect(result.data.bodyFatPct).toBeUndefined();
    }
  });

  it.each([
    ['2026-13-40', 'impossible date'],
    ['09-07-2026', 'wrong format'],
    ['', 'empty date'],
  ])('rejects evaluationDate %p (%s)', (evaluationDate) => {
    expect(evaluationFormSchema.safeParse({ ...valid, evaluationDate }).success).toBe(false);
  });

  it.each([
    ['0', 'zero'],
    ['-3', 'negative'],
    ['600', 'above max'],
    ['', 'blank (required)'],
  ])('rejects weightKg %p (%s)', (weightKg) => {
    expect(evaluationFormSchema.safeParse({ ...valid, weightKg }).success).toBe(false);
  });

  it('treats blank optional metrics as undefined rather than NaN', () => {
    const result = evaluationFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.muscleMassKg).toBeUndefined();
      expect(result.data.bloodPressureSystolic).toBeUndefined();
      expect(result.data.restingHeartRate).toBeUndefined();
    }
  });

  it('validates optional numeric bounds when present', () => {
    expect(evaluationFormSchema.safeParse({ ...valid, bodyFatPct: '120' }).success).toBe(false);
    expect(evaluationFormSchema.safeParse({ ...valid, sleepQuality: '6' }).success).toBe(false);
    expect(evaluationFormSchema.safeParse({ ...valid, stressLevel: '0' }).success).toBe(false);
    expect(evaluationFormSchema.safeParse({ ...valid, activityLevel: 'MODERATE' }).success).toBe(
      true,
    );
  });
});

describe('toEvaluationInput', () => {
  const parsed = (overrides: Record<string, unknown> = {}): EvaluationFormOutput => {
    const result = evaluationFormSchema.safeParse({ ...valid, ...overrides });
    if (!result.success) throw new Error('fixture should parse');
    return result.data;
  };

  it('maps parsed output onto the domain EvaluationInput shape', () => {
    const input = toEvaluationInput(
      parsed({ weightKg: '82', bodyFatPct: '21', activityLevel: 'MODERATE' }),
    );
    expect(input.evaluationDate).toBe('2026-07-09');
    expect(input.weightKg).toBe(82);
    expect(input.bodyFatPct).toBe(21);
    expect(input.activityLevel).toBe('MODERATE');
  });

  it('normalizes omitted optional metrics to null (not undefined) for persistence', () => {
    const input = toEvaluationInput(parsed());
    expect(input.muscleMassKg).toBeNull();
    expect(input.bloodPressureSystolic).toBeNull();
    expect(input.restingHeartRate).toBeNull();
    expect(input.activityLevel).toBeNull();
  });

  it('trims free-text and maps blank free-text to null', () => {
    const withText = toEvaluationInput(parsed({ doctorNotes: '  cleared for training  ' }));
    expect(withText.doctorNotes).toBe('cleared for training');
    const blank = toEvaluationInput(parsed({ doctorNotes: '   ' }));
    expect(blank.doctorNotes).toBeNull();
    expect(blank.medicalConditions).toBeNull();
    expect(blank.medications).toBeNull();
  });
});

describe('evaluationFormDefaults / todayIso', () => {
  it("defaults the evaluation date to today's YYYY-MM-DD and leaves metrics blank", () => {
    const defaults = evaluationFormDefaults();
    expect(defaults.evaluationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaults.evaluationDate).toBe(todayIso());
    expect(defaults.weightKg).toBe('');
    expect(defaults.activityLevel).toBeUndefined();
  });

  it('produces defaults that fail validation until a weight is entered', () => {
    // Date is valid, but weight is required — the form must gate on it.
    expect(evaluationFormSchema.safeParse(evaluationFormDefaults()).success).toBe(false);
  });
});
