import type { Goal } from '../domain/goal.types';
import {
  goalFormSchema,
  goalToFormValues,
  toGoalInput,
  type GoalFormOutput,
} from './goal-form.schema';

/**
 * The schema is the single validation source of truth for the goal form,
 * and the adapters bridge it to/from the domain shape. These cover the
 * required goal type, the optional-blank handling the UI relies on (empty
 * text inputs must not become NaN or a bad date), and the round-trip
 * mapping used for edit prefill.
 */

const validValues = {
  goalType: 'FAT_LOSS',
  targetWeightKg: '',
  targetDate: '',
};

describe('goalFormSchema', () => {
  it('accepts a minimal valid form with only a goal type', () => {
    const result = goalFormSchema.safeParse(validValues);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goalType).toBe('FAT_LOSS');
      expect(result.data.targetWeightKg).toBeUndefined();
      expect(result.data.targetDate).toBeUndefined();
    }
  });

  it('requires a valid goal type', () => {
    expect(goalFormSchema.safeParse({ ...validValues, goalType: undefined }).success).toBe(false);
    expect(goalFormSchema.safeParse({ ...validValues, goalType: 'NOT_A_GOAL' }).success).toBe(
      false,
    );
  });

  it('coerces a provided target weight to a number', () => {
    const result = goalFormSchema.safeParse({ ...validValues, targetWeightKg: '78' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetWeightKg).toBe(78);
      expect(typeof result.data.targetWeightKg).toBe('number');
    }
  });

  it.each([
    ['0', 'zero'],
    ['-5', 'negative'],
    ['600', 'above max'],
  ])('rejects target weight %p (%s)', (targetWeightKg) => {
    expect(goalFormSchema.safeParse({ ...validValues, targetWeightKg }).success).toBe(false);
  });

  it('accepts a well-formed target date', () => {
    const result = goalFormSchema.safeParse({ ...validValues, targetDate: '2026-12-31' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.targetDate).toBe('2026-12-31');
  });

  it.each([
    ['2026-13-40', 'impossible date'],
    ['31-12-2026', 'wrong format'],
    ['soon', 'non-date'],
  ])('rejects target date %p (%s)', (targetDate) => {
    expect(goalFormSchema.safeParse({ ...validValues, targetDate }).success).toBe(false);
  });
});

describe('toGoalInput', () => {
  const parsed = (overrides: Record<string, unknown> = {}): GoalFormOutput => {
    const result = goalFormSchema.safeParse({ ...validValues, ...overrides });
    if (!result.success) throw new Error('fixture should parse');
    return result.data;
  };

  it('maps parsed output onto the domain GoalInput shape', () => {
    const input = toGoalInput(parsed({ targetWeightKg: '78', targetDate: '2026-12-31' }));
    expect(input).toEqual({ goalType: 'FAT_LOSS', targetWeightKg: 78, targetDate: '2026-12-31' });
  });

  it('normalizes omitted optional fields to null (not undefined) for persistence', () => {
    const input = toGoalInput(parsed());
    expect(input.targetWeightKg).toBeNull();
    expect(input.targetDate).toBeNull();
  });
});

describe('goalToFormValues', () => {
  const goal: Goal = {
    id: 'g1',
    userId: 'u1',
    goalType: 'MUSCLE_GAIN',
    targetWeightKg: 82,
    targetDate: '2027-01-15',
    isActive: true,
    startedAt: '2026-07-01T00:00:00.000Z',
    endedAt: null,
    version: 3,
    syncStatus: 'pending',
  };

  it('stringifies numeric fields for text inputs', () => {
    const values = goalToFormValues(goal);
    expect(values.goalType).toBe('MUSCLE_GAIN');
    expect(values.targetWeightKg).toBe('82');
    expect(values.targetDate).toBe('2027-01-15');
  });

  it('produces safe defaults for a null goal (create mode)', () => {
    const values = goalToFormValues(null);
    expect(values.goalType).toBe('GENERAL_HEALTH');
    expect(values.targetWeightKg).toBe('');
    expect(values.targetDate).toBe('');
  });

  it('round-trips a goal back through the schema without validation errors', () => {
    const result = goalFormSchema.safeParse(goalToFormValues(goal));
    expect(result.success).toBe(true);
  });
});
