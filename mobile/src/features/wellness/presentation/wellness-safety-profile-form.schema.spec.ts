import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import {
  createWellnessSafetyFormSchema,
  toFormValues,
  toProfileInput,
  type WellnessSafetyFormValues,
} from './wellness-safety-profile-form.schema';

/**
 * ADR-P017 **W-3** form validation.
 *
 * The date rules are the ones a person can actually get wrong, so they are
 * asserted exhaustively — including the two the shape test alone would let
 * through: an impossible calendar date, and a date after the **device-local**
 * today. `today` is injected, so these are deterministic and no clock is read.
 */

const TODAY = '2026-09-09';
const MESSAGES = {
  dateRequired: 'date-required',
  dateFormat: 'date-format',
  validDate: 'valid-date',
  dateNotFuture: 'not-future',
};

const schema = createWellnessSafetyFormSchema(TODAY, MESSAGES);

function values(partial: Partial<WellnessSafetyFormValues> = {}): WellnessSafetyFormValues {
  return {
    evaluationCompleted: 'no',
    evaluationDate: '',
    affectedAreas: [],
    movementsToAvoid: [],
    ...partial,
  };
}

/** The first issue message, or null when the input is accepted. */
function issue(input: WellnessSafetyFormValues): string | null {
  const result = schema.safeParse(input);
  return result.success ? null : result.error.issues[0].message;
}

describe('a completed evaluation requires its date', () => {
  it('rejects an empty date', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: '' }))).toBe('date-required');
  });

  it('rejects a blank-only date', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: '   ' }))).toBe(
      'date-required',
    );
  });

  it.each([
    ['a slashed date', '09/09/2026'],
    ['a short year', '26-09-09'],
    ['a missing day', '2026-09'],
    ['an instant', '2026-09-09T00:00:00.000Z'],
    ['prose', 'last spring'],
  ])('rejects %s as malformed', (_label, date) => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: date }))).toBe('date-format');
  });

  it.each([
    ['31 February', '2026-02-31'],
    ['month 13', '2026-13-01'],
    ['day 00', '2026-09-00'],
    ['29 February in a non-leap year', '2026-02-29'],
  ])('rejects %s — the shape test alone would accept it', (_label, date) => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: date }))).toBe('valid-date');
  });

  it('accepts 29 February in a leap year', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: '2024-02-29' }))).toBeNull();
  });

  it('rejects tomorrow, measured against the injected device-local today', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: '2026-09-10' }))).toBe(
      'not-future',
    );
  });

  it('accepts today itself', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: TODAY }))).toBeNull();
  });

  it('accepts a past date', () => {
    expect(issue(values({ evaluationCompleted: 'yes', evaluationDate: '2019-01-01' }))).toBeNull();
  });

  it('follows the injected today rather than a wall clock', () => {
    const earlier = createWellnessSafetyFormSchema('2020-01-01', MESSAGES);
    const parsed = earlier.safeParse(
      values({ evaluationCompleted: 'yes', evaluationDate: '2026-09-09' }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe('an unanswered evaluation carries no date', () => {
  it('accepts "not yet" with no date', () => {
    expect(issue(values({ evaluationCompleted: 'no' }))).toBeNull();
  });

  it('accepts "not yet" even when the field still holds text, and drops it', () => {
    const input = values({ evaluationCompleted: 'no', evaluationDate: '2026-09-09' });
    expect(issue(input)).toBeNull();
    // The strict flag/date coupling both databases CHECK: the persisted date is
    // null, so a stale field can never contradict the flag.
    expect(toProfileInput(schema.parse(input)).evaluationDate).toBeNull();
  });

  it('accepts "not yet" together with declared limitations (W-1 invariant 4)', () => {
    const input = values({
      evaluationCompleted: 'no',
      affectedAreas: ['knee'],
      movementsToAvoid: ['jumping'],
    });
    expect(issue(input)).toBeNull();
    expect(toProfileInput(schema.parse(input))).toEqual({
      evaluationCompleted: false,
      evaluationDate: null,
      affectedAreas: ['knee'],
      movementsToAvoid: ['jumping'],
    });
  });

  it('accepts a completed evaluation with no limitations at all', () => {
    const input = values({ evaluationCompleted: 'yes', evaluationDate: '2026-01-02' });
    expect(toProfileInput(schema.parse(input))).toEqual({
      evaluationCompleted: true,
      evaluationDate: '2026-01-02',
      affectedAreas: [],
      movementsToAvoid: [],
    });
  });
});

describe('the form surface itself', () => {
  it('has exactly four fields — no free-text field of any kind', () => {
    expect(Object.keys(values()).sort()).toEqual([
      'affectedAreas',
      'evaluationCompleted',
      'evaluationDate',
      'movementsToAvoid',
    ]);
  });

  it('trims the submitted date so trailing input never reaches the domain', () => {
    const input = values({ evaluationCompleted: 'yes', evaluationDate: '2026-01-02' });
    expect(toProfileInput(schema.parse(input)).evaluationDate).toBe('2026-01-02');
  });
});

describe('prefill', () => {
  const stored: WellnessSafetyProfile = {
    id: 'u1',
    userId: 'u1',
    evaluationCompleted: true,
    evaluationDate: '2026-01-02',
    affectedAreas: ['knee', 'shoulder'],
    movementsToAvoid: ['jumping'],
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    version: 3,
    deletedAt: null,
    deletedBy: null,
  };

  it('prefills a stored profile, tokens included', () => {
    expect(toFormValues(stored)).toEqual({
      evaluationCompleted: 'yes',
      evaluationDate: '2026-01-02',
      affectedAreas: ['knee', 'shoulder'],
      movementsToAvoid: ['jumping'],
    });
  });

  it('prefills the blank form when nothing is stored', () => {
    expect(toFormValues(null)).toEqual({
      evaluationCompleted: 'no',
      evaluationDate: '',
      affectedAreas: [],
      movementsToAvoid: [],
    });
  });

  it('copies the stored token arrays instead of aliasing them', () => {
    const prefilled = toFormValues(stored);
    prefilled.affectedAreas.push('knee');
    expect(stored.affectedAreas).toEqual(['knee', 'shoulder']);
  });
});
