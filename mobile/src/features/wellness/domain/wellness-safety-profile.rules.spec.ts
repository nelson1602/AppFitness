import { WELLNESS_AFFECTED_AREAS, WELLNESS_MOVEMENTS_TO_AVOID } from './wellness-safety-profile';
import {
  WELLNESS_SAFETY_PROFILE_ENTITY,
  WellnessProfileInvalid,
  deviceToday,
  isCalendarDate,
  normalizeAffectedAreas,
  normalizeMovementsToAvoid,
  normalizeProfileInput,
  toWirePayload,
  wellnessSafetyProfileId,
  type WellnessProfileInvalidReason,
} from './wellness-safety-profile.rules';

/**
 * ADR-P017 **W-2** domain rules.
 *
 * The normalization table below is duplicated verbatim in the API spec
 * (`api/src/modules/wellness/domain/wellness-payload.spec.ts`): there is no
 * shared package between the two, so identical fixtures are how "the same
 * algorithm on both sides" is asserted rather than assumed.
 */

/** Shared fixtures — keep in lockstep with the API spec. */
const NORMALIZATION_CASES: [label: string, input: string[], expected: string[]][] = [
  ['sorts', ['knee', 'ankle'], ['ankle', 'knee']],
  ['deduplicates', ['knee', 'knee', 'knee'], ['knee']],
  ['trims', ['  knee  ', 'hip'], ['hip', 'knee']],
  ['lowercases', ['KNEE', 'Hip'], ['hip', 'knee']],
  [
    'trims, lowercases, deduplicates and sorts together',
    [' Upper_Back', 'knee', 'KNEE', 'ankle ', 'upper_back'],
    ['ankle', 'knee', 'upper_back'],
  ],
  ['accepts an empty list', [], []],
];

const INVALID_TOKEN_CASES: [label: string, input: unknown, reason: WellnessProfileInvalidReason][] =
  [
    ['an unknown token', ['spleen'], 'unknown-token'],
    [
      'a lowercase clinical narrative',
      ['patient reports chronic lower back pain after l4-l5 disc surgery'],
      'unknown-token',
    ],
    ['a blank string', [''], 'blank-token'],
    ['whitespace only', ['   '], 'blank-token'],
    ['a number', [7], 'not-a-string'],
    ['a boolean', [true], 'not-a-string'],
    ['null', [null], 'not-a-string'],
    ['an object', [{ area: 'knee' }], 'not-a-string'],
    ['a nested array', [['knee']], 'not-a-string'],
    ['a non-array', 'knee', 'not-an-array'],
    ['too many entries', Array.from({ length: 65 }, () => 'knee'), 'too-many-tokens'],
  ];

const TODAY = '2026-09-09';

function reasonOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof WellnessProfileInvalid ? error.reason : `unexpected:${String(error)}`;
  }
  return 'no-error';
}

describe('wellness safety profile rules', () => {
  it('names the entity type the queue, applier and server share', () => {
    expect(WELLNESS_SAFETY_PROFILE_ENTITY).toBe('wellness_safety_profiles');
  });

  describe('token normalization', () => {
    it.each(NORMALIZATION_CASES)('%s (affected areas)', (_label, input, expected) => {
      expect(normalizeAffectedAreas(input)).toEqual(expected);
    });

    it('is deterministic and idempotent over the whole vocabulary', () => {
      const shuffled = [...WELLNESS_AFFECTED_AREAS].reverse();
      const once = normalizeAffectedAreas(shuffled);
      expect(once).toEqual([...WELLNESS_AFFECTED_AREAS]);
      expect(normalizeAffectedAreas(once)).toEqual(once);

      const movements = normalizeMovementsToAvoid([...WELLNESS_MOVEMENTS_TO_AVOID].reverse());
      expect(movements).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID]);
      expect(normalizeMovementsToAvoid(movements)).toEqual(movements);
    });

    it.each(INVALID_TOKEN_CASES)('rejects %s', (_label, input, reason) => {
      expect(reasonOf(() => normalizeAffectedAreas(input))).toBe(reason);
      expect(reasonOf(() => normalizeMovementsToAvoid(input))).toBe(reason);
    });

    it('keeps the two vocabularies apart', () => {
      expect(reasonOf(() => normalizeAffectedAreas(['deep_squat']))).toBe('unknown-token');
      expect(reasonOf(() => normalizeMovementsToAvoid(['knee']))).toBe('unknown-token');
    });
  });

  describe('calendar dates', () => {
    it.each([
      ['2026-09-09', true],
      ['2024-02-29', true],
      ['2026-02-31', false],
      ['2026-13-01', false],
      ['2026-00-10', false],
      ['2026-9-9', false],
      ['09-09-2026', false],
      ['2026/09/09', false],
      ['2026-09-09T00:00:00Z', false],
      ['yesterday', false],
      ['', false],
    ])('isCalendarDate(%s) === %s', (value, expected) => {
      expect(isCalendarDate(value)).toBe(expected);
    });

    it('derives the device-local calendar date, not the UTC one', () => {
      // 2026-09-09T23:30 local — a UTC-based derivation could report the 10th.
      const local = new Date(2026, 8, 9, 23, 30, 0);
      expect(deviceToday(local)).toBe('2026-09-09');
    });
  });

  describe('flag/date consistency', () => {
    it('accepts a completed evaluation with a past date', () => {
      expect(
        normalizeProfileInput(
          {
            evaluationCompleted: true,
            evaluationDate: '2026-01-02',
            affectedAreas: ['knee'],
            movementsToAvoid: ['jumping'],
          },
          TODAY,
        ),
      ).toEqual({
        evaluationCompleted: true,
        evaluationDate: '2026-01-02',
        affectedAreas: ['knee'],
        movementsToAvoid: ['jumping'],
      });
    });

    it('accepts today', () => {
      expect(
        normalizeProfileInput(
          {
            evaluationCompleted: true,
            evaluationDate: TODAY,
            affectedAreas: [],
            movementsToAvoid: [],
          },
          TODAY,
        ).evaluationDate,
      ).toBe(TODAY);
    });

    it('accepts a not-completed evaluation with no date, and limitations alone', () => {
      expect(
        normalizeProfileInput(
          {
            evaluationCompleted: false,
            evaluationDate: null,
            affectedAreas: ['hip'],
            movementsToAvoid: [],
          },
          TODAY,
        ),
      ).toEqual({
        evaluationCompleted: false,
        evaluationDate: null,
        affectedAreas: ['hip'],
        movementsToAvoid: [],
      });
    });

    it.each([
      [
        'completed with no date',
        { evaluationCompleted: true, evaluationDate: null },
        'date-required',
      ],
      [
        'not completed with a date',
        { evaluationCompleted: false, evaluationDate: '2026-01-02' },
        'date-not-allowed',
      ],
      [
        'a malformed date',
        { evaluationCompleted: true, evaluationDate: '2026-9-9' },
        'date-malformed',
      ],
      [
        'an impossible calendar date',
        { evaluationCompleted: true, evaluationDate: '2026-02-31' },
        'date-not-a-calendar-date',
      ],
      [
        'a device-local future date',
        { evaluationCompleted: true, evaluationDate: '2026-09-10' },
        'date-in-the-future',
      ],
      [
        'a far-future date',
        { evaluationCompleted: true, evaluationDate: '2099-01-01' },
        'date-in-the-future',
      ],
    ])('rejects %s', (_label, dates, reason) => {
      expect(
        reasonOf(() =>
          normalizeProfileInput({ ...dates, affectedAreas: [], movementsToAvoid: [] }, TODAY),
        ),
      ).toBe(reason);
    });

    it('rejects a nonsense injected today rather than skipping the bound', () => {
      expect(
        reasonOf(() =>
          normalizeProfileInput(
            {
              evaluationCompleted: true,
              evaluationDate: '2026-01-02',
              affectedAreas: [],
              movementsToAvoid: [],
            },
            'not-a-date',
          ),
        ),
      ).toBe('date-malformed');
    });
  });

  describe('singleton identity', () => {
    it('uses the authenticated user id as the aggregate id', () => {
      const userId = '11111111-1111-4111-8111-111111111111';
      expect(wellnessSafetyProfileId(userId)).toBe(userId);
    });

    it('gives two devices for the same user one identity', () => {
      const userId = '22222222-2222-4222-8222-222222222222';
      expect(wellnessSafetyProfileId(userId)).toBe(wellnessSafetyProfileId(userId));
    });
  });

  it('emits a snake_case wire payload with no server-owned or free-text field', () => {
    const payload = toWirePayload({
      evaluationCompleted: true,
      evaluationDate: '2026-01-02',
      affectedAreas: ['knee'],
      movementsToAvoid: ['jumping'],
    });
    expect(Object.keys(payload).sort()).toEqual([
      'affected_areas',
      'evaluation_completed',
      'evaluation_date',
      'movements_to_avoid',
    ]);
  });
});
