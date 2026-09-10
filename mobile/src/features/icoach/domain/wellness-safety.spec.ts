import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
} from '@/features/wellness/domain/wellness-safety-profile';
import { BUILT_IN_EXERCISES } from '@/features/workout/infrastructure/exercise-catalog.data';

import { evaluate } from './engine';
import { ENGINE_RULE_VERSION } from './rule-versions';
import type { EngineInput } from './types';
import {
  analyzeWellnessSafety,
  isWellnessAffectedArea,
  isWellnessMovementToAvoid,
  WELLNESS_REASON_MOVEMENT_DECLARED,
  WellnessSafetyInputInvalid,
  type WellnessSafetyInput,
} from './wellness-safety';

/**
 * ADR-P031 W-4B, group **A** (tests A1 … A8).
 *
 * Deterministic: no clock, no randomness, no network, no database. Every table
 * is derived from the **shipped** constants, so widening a vocabulary or
 * changing the catalogue fails a test here rather than silently changing what a
 * user's declaration does to their plan.
 */

const input = (over: Partial<WellnessSafetyInput> = {}): WellnessSafetyInput => ({
  evaluationCompleted: false,
  evaluationDate: null,
  affectedAreas: [],
  movementsToAvoid: [],
  ...over,
});

const engineInput = (wellness?: WellnessSafetyInput): EngineInput => ({
  subject: { age: 30, sex: 'MALE', heightCm: 180, weightKg: 80, bodyFatPct: 20 },
  activityLevel: 'MODERATE',
  goal: 'FAT_LOSS',
  fitnessLevel: 'INTERMEDIATE',
  restrictions: [],
  recovery: { sleepHours: 7.5, stressLevel: 2 },
  trainingDaysPreference: 4,
  ...(wellness ? { wellness } : {}),
});

/** The field and rule a refusal reports — never the rejected value. */
const refusalOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof WellnessSafetyInputInvalid) {
      return `${error.field}:${error.reason}`;
    }
    return `unexpected:${String(error)}`;
  }
  return 'no-error';
};

describe('wellness safety analyzer (ADR-P031 W-4B)', () => {
  it('A1: each of the 18 declared movements yields exactly itself', () => {
    expect(WELLNESS_MOVEMENTS_TO_AVOID).toHaveLength(18);

    for (const movement of WELLNESS_MOVEMENTS_TO_AVOID) {
      const analysis = analyzeWellnessSafety(input({ movementsToAvoid: [movement] }));

      // Exactly itself: no widening to a family, no narrowing, no substitution.
      expect(analysis.excludedMovements).toEqual([movement]);
      expect(analysis.reasons).toEqual([
        {
          code: WELLNESS_REASON_MOVEMENT_DECLARED,
          inputs: { movement },
          ruleVersion: ENGINE_RULE_VERSION,
        },
      ]);
    }

    // And all 18 at once: the whole vocabulary, sorted, nothing invented.
    const all = analyzeWellnessSafety(input({ movementsToAvoid: WELLNESS_MOVEMENTS_TO_AVOID }));
    expect(all.excludedMovements).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID].sort());
    expect(all.excludedMovements).toHaveLength(18);
  });

  it('A2: every emitted token is a shipped token that a shipped exercise uses', () => {
    const vocabulary = new Set<string>(WELLNESS_MOVEMENTS_TO_AVOID);
    const catalogueMovements = new Set(
      BUILT_IN_EXERCISES.flatMap((exercise) => exercise.movementPatterns as readonly string[]),
    );

    const emitted = analyzeWellnessSafety(
      input({ movementsToAvoid: WELLNESS_MOVEMENTS_TO_AVOID }),
    ).excludedMovements;

    // Subset of the shipped vocabulary: the analyzer can never invent a token.
    expect(emitted.filter((token) => !vocabulary.has(token))).toEqual([]);
    // And every emitted token still matches at least one catalogue exercise, so
    // a declaration always has something to act on once W-4D activates.
    expect(emitted.filter((token) => !catalogueMovements.has(token))).toEqual([]);

    // An unknown token is REFUSED, never dropped: dropping it would turn a
    // corrupt payload into a plan with no limitations at all.
    expect(
      refusalOf(() =>
        analyzeWellnessSafety(
          input({ movementsToAvoid: ['not_a_movement'] as unknown as WellnessMovementToAvoid[] }),
        ),
      ),
    ).toBe('movementsToAvoid:unknown-token');

    // Including when it travels beside perfectly good tokens: the list is
    // validated in full or refused in full, never partially accepted.
    expect(
      refusalOf(() =>
        analyzeWellnessSafety(
          input({
            movementsToAvoid: [
              'jumping',
              'behind_neck_press',
            ] as unknown as WellnessMovementToAvoid[],
          }),
        ),
      ),
    ).toBe('movementsToAvoid:unknown-token');
    expect(isWellnessMovementToAvoid('not_a_movement')).toBe(false);
    expect(isWellnessMovementToAvoid('deep_squat')).toBe(true);
    // `behind_neck_press` is a MEDICAL exclusion token, not a wellness one:
    // the two vocabularies are not interchangeable.
    expect(isWellnessMovementToAvoid('behind_neck_press')).toBe(false);
  });

  it('A3: each of the 18 affected areas is computationally inert', () => {
    expect(WELLNESS_AFFECTED_AREAS).toHaveLength(18);

    for (const area of WELLNESS_AFFECTED_AREAS) {
      const analysis = analyzeWellnessSafety(input({ affectedAreas: [area] }));
      expect(analysis.excludedMovements).toEqual([]);
      expect(analysis.reasons).toEqual([]);
    }

    // All 18 together — including the areas an area → movement mapping would
    // have been most tempted to act on (`knee`, `shoulder`, `lower_back`).
    const everyArea = analyzeWellnessSafety(input({ affectedAreas: WELLNESS_AFFECTED_AREAS }));
    expect(everyArea.excludedMovements).toEqual([]);
    expect(everyArea.reasons).toEqual([]);

    // An area never adds to, subtracts from or reorders a declared movement set.
    const withMovement = analyzeWellnessSafety(
      input({ affectedAreas: WELLNESS_AFFECTED_AREAS, movementsToAvoid: ['jumping'] }),
    );
    expect(withMovement.excludedMovements).toEqual(['jumping']);
  });

  it('A4: all 18 areas remain accepted, valid inputs — inert, not rejected', () => {
    for (const area of WELLNESS_AFFECTED_AREAS) {
      expect(isWellnessAffectedArea(area)).toBe(true);
    }
    expect(isWellnessAffectedArea('not_an_area')).toBe(false);

    // Accepted without throwing, and carried on the input unchanged: the field
    // exists to be stored and displayed (ADR-P031 Decision 4).
    const declared = input({ affectedAreas: WELLNESS_AFFECTED_AREAS });
    expect(() => analyzeWellnessSafety(declared)).not.toThrow();
    expect(declared.affectedAreas).toEqual(WELLNESS_AFFECTED_AREAS);
  });

  it('A5: evaluation fields change nothing, in the analyzer or the engine', () => {
    const movements: WellnessMovementToAvoid[] = ['deep_squat', 'jumping'];
    const notEvaluated = input({ movementsToAvoid: movements });
    const evaluated = input({
      movementsToAvoid: movements,
      evaluationCompleted: true,
      evaluationDate: '2026-01-15',
    });

    // Both computed at the CURRENT rule version — an equality between two
    // present-day results, never against the pre-W-4B baseline.
    expect(JSON.stringify(analyzeWellnessSafety(evaluated))).toBe(
      JSON.stringify(analyzeWellnessSafety(notEvaluated)),
    );
    expect(JSON.stringify(evaluate(engineInput(evaluated)))).toBe(
      JSON.stringify(evaluate(engineInput(notEvaluated))),
    );

    // A completed evaluation never unlocks, clears or widens anything: with no
    // declared movement it produces no exclusion at all.
    const cleared = analyzeWellnessSafety(
      input({ evaluationCompleted: true, evaluationDate: '2026-01-15' }),
    );
    expect(cleared.excludedMovements).toEqual([]);
    expect(cleared.reasons).toEqual([]);
  });

  it('A6: the return type carries exclusions and reasons — nothing else', () => {
    const analysis = analyzeWellnessSafety(input({ movementsToAvoid: ['lunge'] }));

    // Structural: adding severity, workload, intensity, clearance, a diagnosis
    // or a nutrition field has to be a deliberate contract change.
    expect(Object.keys(analysis).sort()).toEqual(['excludedMovements', 'reasons']);
    expect(Object.keys(analysis.reasons[0]).sort()).toEqual(['code', 'inputs', 'ruleVersion']);
    expect(analysis.reasons[0].ruleVersion).toBe(ENGINE_RULE_VERSION);
    expect(Object.keys(analysis.reasons[0].inputs)).toEqual(['movement']);

    const forbidden = [
      'severity',
      'workload',
      'volumeReduction',
      'intensity',
      'intensityCap',
      'rpeCap',
      'daysPerWeek',
      'blocked',
      'requiresMedicalClearance',
      'clearance',
      'diagnosis',
      'nutrition',
      'calories',
      'bloodPressure',
    ];
    const serialized = JSON.stringify(analysis);
    expect(forbidden.filter((key) => serialized.includes(key))).toEqual([]);
  });

  it('A7: empty and absent produce nothing; malformed fails closed', () => {
    for (const candidate of [
      input(),
      input({ movementsToAvoid: [] }),
      input({ affectedAreas: [], movementsToAvoid: [] }),
    ]) {
      expect(analyzeWellnessSafety(candidate).excludedMovements).toEqual([]);
      expect(analyzeWellnessSafety(candidate).reasons).toEqual([]);
    }

    // No wellness input at all — the dormant production shape.
    expect(analyzeWellnessSafety(undefined).excludedMovements).toEqual([]);
    expect(analyzeWellnessSafety(null).reasons).toEqual([]);

    // A value that is not an array at all, which the type forbids but a
    // runtime boundary can still deliver: REFUSED, never coerced to empty.
    for (const malformed of [null, undefined, 'deep_squat', { 0: 'deep_squat' }, 7]) {
      expect(
        refusalOf(() =>
          analyzeWellnessSafety(
            input({ movementsToAvoid: malformed as unknown as WellnessMovementToAvoid[] }),
          ),
        ),
      ).toBe('movementsToAvoid:not-an-array');
      expect(
        refusalOf(() =>
          analyzeWellnessSafety(
            input({ affectedAreas: malformed as unknown as WellnessAffectedArea[] }),
          ),
        ),
      ).toBe('affectedAreas:not-an-array');
    }

    // A non-string entry is its own failure, told apart from a vocabulary
    // mismatch so the reason a caller branches on stays precise.
    for (const entry of [7, null, undefined, {}, []]) {
      expect(
        refusalOf(() =>
          analyzeWellnessSafety(
            input({ movementsToAvoid: [entry] as unknown as WellnessMovementToAvoid[] }),
          ),
        ),
      ).toBe('movementsToAvoid:not-a-string');
    }

    // The inert field is validated just as strictly: inert is not unchecked,
    // and a corrupt area list is evidence the payload cannot be trusted.
    expect(
      refusalOf(() =>
        analyzeWellnessSafety(
          input({ affectedAreas: ['head'] as unknown as WellnessAffectedArea[] }),
        ),
      ),
    ).toBe('affectedAreas:unknown-token');

    // The refusal names the field and the rule and carries NO value: an
    // error travels into logs and Sentry, where a declared token may never
    // appear (ADR-P031 Decision 10).
    let thrown: WellnessSafetyInputInvalid | null = null;
    try {
      analyzeWellnessSafety(
        input({ movementsToAvoid: ['not_a_movement'] as unknown as WellnessMovementToAvoid[] }),
      );
    } catch (error) {
      thrown = error as WellnessSafetyInputInvalid;
    }
    expect(thrown).toBeInstanceOf(WellnessSafetyInputInvalid);
    expect(thrown?.name).toBe('WellnessSafetyInputInvalid');
    expect(thrown?.field).toBe('movementsToAvoid');
    expect(thrown?.reason).toBe('unknown-token');
    expect(thrown?.message).toBe('movementsToAvoid: unknown-token');
    expect(`${thrown?.message} ${thrown?.stack ?? ''}`).not.toContain('not_a_movement');

    // Deterministic: the same malformed input always reports the same thing.
    const twice = [1, 2].map(() =>
      refusalOf(() =>
        analyzeWellnessSafety(
          input({ movementsToAvoid: ['not_a_movement'] as unknown as WellnessMovementToAvoid[] }),
        ),
      ),
    );
    expect(twice[0]).toBe(twice[1]);
  });

  it('A8: order-independent and idempotent', () => {
    const forward = [...WELLNESS_MOVEMENTS_TO_AVOID];
    const reversed = [...forward].reverse();
    const shuffled: WellnessMovementToAvoid[] = [
      'sprinting',
      'deep_squat',
      'valsalva_heavy_lifts',
      'bridging',
      'lunge',
      'deep_squat', // duplicate — collapses
    ];

    const expected = JSON.stringify(analyzeWellnessSafety(input({ movementsToAvoid: forward })));
    expect(JSON.stringify(analyzeWellnessSafety(input({ movementsToAvoid: reversed })))).toBe(
      expected,
    );

    // Duplicates collapse and the order is the sorted order, whatever arrives.
    const collapsed = analyzeWellnessSafety(input({ movementsToAvoid: shuffled }));
    expect(collapsed.excludedMovements).toEqual([
      'bridging',
      'deep_squat',
      'lunge',
      'sprinting',
      'valsalva_heavy_lifts',
    ]);
    expect(collapsed.reasons.map((reason) => reason.inputs.movement)).toEqual(
      collapsed.excludedMovements,
    );

    // Running twice changes nothing, and the analyzer never mutates its input.
    const declared = input({ movementsToAvoid: shuffled });
    const first = JSON.stringify(analyzeWellnessSafety(declared));
    expect(JSON.stringify(analyzeWellnessSafety(declared))).toBe(first);
    expect(declared.movementsToAvoid).toEqual(shuffled);

    // Areas cannot reorder or perturb the result either.
    const areasFirst: WellnessAffectedArea[] = [...WELLNESS_AFFECTED_AREAS];
    expect(
      JSON.stringify(
        analyzeWellnessSafety(input({ affectedAreas: areasFirst, movementsToAvoid: forward })),
      ),
    ).toBe(expected);
  });
});
