import {
  WellnessPayloadError,
  isCalendarDate,
  maxEvaluationDate,
  parseWellnessSafetyProfileWrite,
} from './wellness-payload';
import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
} from './wellness.types';

/**
 * ADR-P017 **W-2** server-side payload rules.
 *
 * `NORMALIZATION_CASES` and `INVALID_TOKEN_CASES` are duplicated verbatim from
 * the mobile spec (`mobile/src/features/wellness/domain/
 * wellness-safety-profile.rules.spec.ts`). There is no shared package between
 * the two, so identical fixtures on both sides are how "the same normalization
 * everywhere" is asserted rather than assumed.
 */

/** Shared fixtures — keep in lockstep with the mobile spec. */
const NORMALIZATION_CASES: [
  label: string,
  input: string[],
  expected: string[],
][] = [
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

const INVALID_TOKEN_CASES: [label: string, input: unknown][] = [
  ['an unknown token', ['spleen']],
  [
    'a lowercase clinical narrative',
    ['patient reports chronic lower back pain after l4-l5 disc surgery'],
  ],
  ['a blank string', ['']],
  ['whitespace only', ['   ']],
  ['a number', [7]],
  ['a boolean', [true]],
  ['null', [null]],
  ['an object', [{ area: 'knee' }]],
  ['a nested array', [['knee']]],
  ['a non-array', 'knee'],
  ['too many entries', Array.from({ length: 65 }, () => 'knee')],
];

const NOW = new Date('2026-09-09T12:00:00.000Z');

function base(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    evaluation_completed: false,
    evaluation_date: null,
    affected_areas: [],
    movements_to_avoid: [],
    ...overrides,
  };
}

describe('wellness payload parsing', () => {
  describe('token normalization', () => {
    it.each(NORMALIZATION_CASES)(
      '%s (affected areas)',
      (_l, input, expected) => {
        expect(
          parseWellnessSafetyProfileWrite(base({ affected_areas: input }), NOW)
            .affectedAreas,
        ).toEqual(expected);
      },
    );

    it('is idempotent over the whole vocabulary', () => {
      const areas = parseWellnessSafetyProfileWrite(
        base({ affected_areas: [...WELLNESS_AFFECTED_AREAS].reverse() }),
        NOW,
      ).affectedAreas;
      expect(areas).toEqual([...WELLNESS_AFFECTED_AREAS]);

      const movements = parseWellnessSafetyProfileWrite(
        base({
          movements_to_avoid: [...WELLNESS_MOVEMENTS_TO_AVOID].reverse(),
        }),
        NOW,
      ).movementsToAvoid;
      expect(movements).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID]);
    });

    it.each(INVALID_TOKEN_CASES)('rejects %s', (_l, input) => {
      expect(() =>
        parseWellnessSafetyProfileWrite(base({ affected_areas: input }), NOW),
      ).toThrow(WellnessPayloadError);
      expect(() =>
        parseWellnessSafetyProfileWrite(
          base({ movements_to_avoid: input }),
          NOW,
        ),
      ).toThrow(WellnessPayloadError);
    });

    it('keeps the two vocabularies apart', () => {
      expect(() =>
        parseWellnessSafetyProfileWrite(
          base({ affected_areas: ['deep_squat'] }),
          NOW,
        ),
      ).toThrow(/allowed vocabulary/);
      expect(() =>
        parseWellnessSafetyProfileWrite(
          base({ movements_to_avoid: ['knee'] }),
          NOW,
        ),
      ).toThrow(/allowed vocabulary/);
    });

    it('never echoes the rejected token', () => {
      // The token is user-declared wellness content: it must not reach a log
      // or an error surface.
      try {
        parseWellnessSafetyProfileWrite(
          base({ affected_areas: ['secret-diagnosis-token'] }),
          NOW,
        );
        throw new Error('expected a rejection');
      } catch (error) {
        expect((error as Error).message).not.toContain(
          'secret-diagnosis-token',
        );
      }
    });
  });

  describe('flag/date consistency', () => {
    it('accepts a completed evaluation with a past calendar date', () => {
      const parsed = parseWellnessSafetyProfileWrite(
        base({ evaluation_completed: true, evaluation_date: '2026-01-02' }),
        NOW,
      );
      expect(parsed.evaluationCompleted).toBe(true);
      expect(parsed.evaluationDate?.toISOString()).toBe(
        '2026-01-02T00:00:00.000Z',
      );
    });

    it.each([
      ['completed with no date', { evaluation_completed: true }],
      [
        'completed with a null date',
        { evaluation_completed: true, evaluation_date: null },
      ],
      [
        'not completed with a date',
        { evaluation_completed: false, evaluation_date: '2026-01-02' },
      ],
      [
        'a malformed date',
        { evaluation_completed: true, evaluation_date: '2026-9-9' },
      ],
      [
        'an impossible calendar date',
        { evaluation_completed: true, evaluation_date: '2026-02-31' },
      ],
      [
        'a datetime instead of a calendar date',
        {
          evaluation_completed: true,
          evaluation_date: '2026-01-02T00:00:00Z',
        },
      ],
      ['a non-boolean flag', { evaluation_completed: 'yes' }],
      ['a missing flag', { evaluation_completed: undefined }],
    ])('rejects %s', (_l, overrides) => {
      expect(() =>
        parseWellnessSafetyProfileWrite(base(overrides), NOW),
      ).toThrow(WellnessPayloadError);
    });

    it('ignores server-owned and client-supplied ownership fields', () => {
      const parsed = parseWellnessSafetyProfileWrite(
        base({
          id: 'attacker-chosen-id',
          user_id: '99999999-9999-4999-8999-999999999999',
          version: 99,
          sync_seq: 12345,
          deleted_at: '2020-01-01T00:00:00.000Z',
          affected_areas: ['knee'],
        }),
        NOW,
      );
      // Only the four contract fields survive parsing.
      expect(Object.keys(parsed).sort()).toEqual([
        'affectedAreas',
        'evaluationCompleted',
        'evaluationDate',
        'movementsToAvoid',
      ]);
    });
  });

  describe('the UTC+1-day date bound', () => {
    it('allows UTC-today and one day beyond, for devices ahead of UTC', () => {
      expect(maxEvaluationDate(NOW)).toBe('2026-09-10');
      expect(
        parseWellnessSafetyProfileWrite(
          base({ evaluation_completed: true, evaluation_date: '2026-09-09' }),
          NOW,
        ).evaluationDate,
      ).not.toBeNull();
      expect(
        parseWellnessSafetyProfileWrite(
          base({ evaluation_completed: true, evaluation_date: '2026-09-10' }),
          NOW,
        ).evaluationDate,
      ).not.toBeNull();
    });

    it('rejects two days ahead and anything further', () => {
      for (const date of ['2026-09-11', '2027-01-01', '2099-01-01']) {
        expect(() =>
          parseWellnessSafetyProfileWrite(
            base({ evaluation_completed: true, evaluation_date: date }),
            NOW,
          ),
        ).toThrow(/must not be in the future/);
      }
    });

    it('moves with the injected clock rather than the wall clock', () => {
      const later = new Date('2027-03-04T00:00:00.000Z');
      expect(maxEvaluationDate(later)).toBe('2027-03-05');
      expect(
        parseWellnessSafetyProfileWrite(
          base({ evaluation_completed: true, evaluation_date: '2027-03-04' }),
          later,
        ).evaluationDate,
      ).not.toBeNull();
    });
  });

  describe('calendar dates', () => {
    it.each([
      ['2026-09-09', true],
      ['2024-02-29', true],
      ['2026-02-31', false],
      ['2026-13-01', false],
      ['2026-9-9', false],
      ['', false],
    ])('isCalendarDate(%s) === %s', (value, expected) => {
      expect(isCalendarDate(value)).toBe(expected);
    });
  });
});
