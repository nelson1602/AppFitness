import {
  restrictionFormDefaults,
  restrictionFormSchema,
  toRestrictionInput,
  type RestrictionFormOutput,
} from './restriction-form.schema';
import { todayIso } from './evaluation-form.schema';

/**
 * The schema is the single validation source of truth for the restriction
 * form; the adapter maps parsed output onto the domain RestrictionInput.
 */

const valid = {
  type: 'INJURY',
  bodyArea: '',
  severity: undefined,
  notes: '',
  effectiveFrom: '2026-07-09',
  effectiveUntil: '',
};

describe('restrictionFormSchema', () => {
  it('accepts a minimal valid form (type only)', () => {
    const result = restrictionFormSchema.safeParse({ ...valid, effectiveFrom: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('INJURY');
      expect(result.data.bodyArea).toBeUndefined();
      expect(result.data.severity).toBeUndefined();
    }
  });

  it('requires a valid restriction type', () => {
    expect(restrictionFormSchema.safeParse({ ...valid, type: undefined }).success).toBe(false);
    expect(restrictionFormSchema.safeParse({ ...valid, type: 'SPRAIN' }).success).toBe(false);
  });

  it('validates the optional severity enum', () => {
    expect(restrictionFormSchema.safeParse({ ...valid, severity: 'SEVERE' }).success).toBe(true);
    expect(restrictionFormSchema.safeParse({ ...valid, severity: 'CRITICAL' }).success).toBe(false);
  });

  it.each([
    ['2026-13-40', 'impossible date'],
    ['09-07-2026', 'wrong format'],
  ])('rejects effectiveFrom %p (%s)', (effectiveFrom) => {
    expect(restrictionFormSchema.safeParse({ ...valid, effectiveFrom }).success).toBe(false);
  });
});

describe('toRestrictionInput', () => {
  const parsed = (overrides: Record<string, unknown> = {}): RestrictionFormOutput => {
    const result = restrictionFormSchema.safeParse({ ...valid, ...overrides });
    if (!result.success) throw new Error('fixture should parse');
    return result.data;
  };

  it('maps parsed output onto the domain RestrictionInput shape', () => {
    const input = toRestrictionInput(
      parsed({ bodyArea: 'left knee', severity: 'MODERATE', effectiveUntil: '2026-09-01' }),
    );
    expect(input).toEqual({
      type: 'INJURY',
      bodyArea: 'left knee',
      severity: 'MODERATE',
      notes: null,
      effectiveFrom: '2026-07-09',
      effectiveUntil: '2026-09-01',
    });
  });

  it('trims free-text notes and maps blanks to null', () => {
    expect(toRestrictionInput(parsed({ notes: '  no squats  ' })).notes).toBe('no squats');
    const blank = toRestrictionInput(parsed({ notes: '   ', bodyArea: '  ' }));
    expect(blank.notes).toBeNull();
    expect(blank.bodyArea).toBeNull();
  });

  it('maps omitted optional fields to null', () => {
    const input = toRestrictionInput(parsed({ effectiveFrom: '' }));
    expect(input.severity).toBeNull();
    expect(input.effectiveFrom).toBeNull();
    expect(input.effectiveUntil).toBeNull();
  });
});

describe('restrictionFormDefaults', () => {
  it('defaults to an injury effective from today', () => {
    const defaults = restrictionFormDefaults();
    expect(defaults.type).toBe('INJURY');
    expect(defaults.effectiveFrom).toBe(todayIso());
    expect(restrictionFormSchema.safeParse(defaults).success).toBe(true);
  });
});
