import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
} from '@/features/wellness/domain/wellness-safety-profile';

import { ENGINE_RULE_VERSION } from './rule-versions';

/**
 * Deterministic wellness-safety analysis (ADR-P031 **W-4B**).
 *
 * Pure: no clock, no randomness, no I/O, no storage — identical inputs always
 * produce identical output, as `.ai/07_ICOACH.md` requires of every engine
 * rule. It is **dormant** in this slice: nothing calls it from a production
 * path, and the adapter still supplies no wellness input (§Implementation
 * slices; asserted by `wellness-safety.dormancy.spec.ts`).
 *
 * ── Fail closed, never repair ───────────────────────────────────────────────
 * A present wellness input is **validated in full or refused in full**. An
 * empty exclusion set means "this user declared no limitations", so producing
 * one from data the app could not understand would turn corruption into an
 * unrestricted plan — the single most dangerous direction for a safety rule,
 * and the direction ADR-P031 Decision 8 forbids. So a non-array field, a
 * non-string entry or a token outside the shipped vocabulary throws
 * {@link WellnessSafetyInputInvalid}; nothing is coerced, widened, partially
 * accepted or silently dropped.
 *
 * The **absent** case is different and stays valid: `null` / `undefined` means
 * no profile, and no profile means no declared limitations (Decision 6).
 *
 * The normal validation boundary is still W-2's decoder — an unknown token
 * cannot be stored or pulled — so a throw here means a caller bypassed that
 * boundary or memory was corrupted, and refusing is the only honest answer.
 *
 * ── What it consumes, and what it refuses to infer ──────────────────────────
 * `movementsToAvoid` is the **only computation-authoritative field**
 * (ADR-P031 Decision 3): each declared token is excluded as itself, with no
 * widening, narrowing, substitution or inference.
 *
 * `affectedAreas` is **computationally inert** (Decision 4) but still
 * **strictly validated**: inert is not the same as unchecked, and a corrupt
 * area list is evidence the payload cannot be trusted at all. It produces
 * **zero** exclusions and **zero** reason codes. The drafted area → movement
 * mapping was retracted: it was not repository-provable, and reviving it needs
 * a separate accepted ADR revision plus qualified exercise-domain review.
 * Nothing here infers anatomy, a diagnosis, a severity, the safety of an
 * exercise, or a workload change from an area.
 *
 * `evaluationCompleted` / `evaluationDate` are **records, never permissions**
 * (Decision 2): they record that an evaluation happened and when, and they
 * change nothing this function returns. They never approve, clear, unlock or
 * gate a plan.
 *
 * The return type carries **no** severity, workload, intensity, clearance,
 * diagnosis or nutrition field, and none may be added without a contract
 * change (Decision 5, asserted structurally by the spec).
 *
 * ── Separate from the dormant medical path ──────────────────────────────────
 * This module is not `restrictions.ts`. It imports nothing from
 * `features/medical`, does not read `RestrictionInput`, `BloodPressure`,
 * severity or `BODY_AREA_EXCLUSIONS`, and leaves all of them untouched
 * (ADR-P017 medical dormancy, ADR-P031 Decision 1).
 */

/** What a caller may declare. Populated only from the W-2 boundary. */
export interface WellnessSafetyInput {
  /** Whether the user reports having completed a professional evaluation. */
  evaluationCompleted: boolean;
  /** `YYYY-MM-DD`, or null. Informational only — never a permission. */
  evaluationDate: string | null;
  /** Stored, displayed context. Produces no exclusions (Decision 4). */
  affectedAreas: readonly WellnessAffectedArea[];
  /** The sole source of exclusions (Decision 3). */
  movementsToAvoid: readonly WellnessMovementToAvoid[];
}

/**
 * The only reason code W-4 V1 emits, because a declared movement is the only
 * source of an exclusion (ADR-P031 Decision 10).
 */
export const WELLNESS_REASON_MOVEMENT_DECLARED = 'wellness.movement.declared';

/** Stable rule identifier for the assessment recommendation (Decision 10). */
export const WELLNESS_RULE_MOVEMENT_EXCLUSIONS = 'WELLNESS:movement_exclusions';

/**
 * The stable localization keys the assessment recommendation is rendered from
 * (Decision 10).
 *
 * One family, spelled the way every other key in the shipped catalogues is:
 * dot-separated namespace, **camelCase leaf**. An earlier revision also
 * exported a snake_case `wellness.plan.limitations_applied`, which nothing
 * rendered — two spellings of one idea is how a surface ends up printing a raw
 * key, so the competing spelling is gone.
 */
export const WELLNESS_PLAN_EXPLANATION_KEYS = {
  title: 'wellness.plan.limitationsAppliedTitle',
  body: 'wellness.plan.limitationsAppliedBody',
  basis: 'wellness.plan.limitationsAppliedBasis',
} as const;

/**
 * Why a wellness input was refused. Names the **field and the rule** only.
 *
 * The rejected value is deliberately absent from every reason: a declared
 * token is user wellness content (`.ai/05_SECURITY.md` §Logging), and an error
 * travels into logs, Sentry and crash reports where a token may never appear
 * (ADR-P031 Decision 10). Mirrors W-2's `WellnessProfileInvalid` vocabulary so
 * the two boundaries report the same failures by the same names.
 */
export type WellnessSafetyInputInvalidReason = 'not-an-array' | 'not-a-string' | 'unknown-token';

/** The only field a refusal can name. */
export type WellnessSafetyInputField = 'affectedAreas' | 'movementsToAvoid';

/**
 * A present wellness input that could not be validated (ADR-P031 Decision 8).
 *
 * Deterministic: the same malformed input always produces the same `field` and
 * `reason`, so a caller can branch on it and a test can pin it. Carrying no
 * value is a hard rule, not an omission.
 */
export class WellnessSafetyInputInvalid extends Error {
  constructor(
    readonly reason: WellnessSafetyInputInvalidReason,
    readonly field: WellnessSafetyInputField,
  ) {
    super(`${field}: ${reason}`);
    this.name = 'WellnessSafetyInputInvalid';
  }
}

/**
 * One structured, language-neutral reason for one exclusion.
 *
 * The token inside `inputs` is **validated** and is allowed here: raw tokens
 * are permitted in internal domain structures and forbidden in rendered copy,
 * logs, analytics, Sentry and audit records (ADR-P031 Decision 10). Rendering
 * resolves the token through W-3's one-way token → localization-key map.
 *
 * `ruleVersion` is carried on every reason, not only on the assessment: a
 * stored recommendation must stay traceable to the exact rule revision that
 * produced it (Decision 10, `.ai/07_ICOACH.md` §Versioning).
 */
export interface WellnessExclusionReason {
  /** Always {@link WELLNESS_REASON_MOVEMENT_DECLARED} in W-4 V1. */
  readonly code: typeof WELLNESS_REASON_MOVEMENT_DECLARED;
  readonly inputs: { readonly movement: WellnessMovementToAvoid };
  /** The rule revision that emitted this reason — always `ENGINE_RULE_VERSION`. */
  readonly ruleVersion: string;
}

/** The analysis. Deliberately carries nothing but exclusions and reasons. */
export interface WellnessSafetyAnalysis {
  /** Sorted, de-duplicated, validated movement tokens. */
  readonly excludedMovements: readonly WellnessMovementToAvoid[];
  /** One reason per excluded movement, in the same order. */
  readonly reasons: readonly WellnessExclusionReason[];
}

const EMPTY_ANALYSIS: WellnessSafetyAnalysis = { excludedMovements: [], reasons: [] };

const MOVEMENTS: readonly string[] = WELLNESS_MOVEMENTS_TO_AVOID;

/**
 * True when `value` is a shipped movement token.
 *
 * A guard rather than an inline test, so the narrowing is explicit: the input
 * is typed, but a value crossing a runtime boundary can still be anything, and
 * only a token proven to be in the shipped vocabulary may reach the output.
 */
export function isWellnessMovementToAvoid(value: unknown): value is WellnessMovementToAvoid {
  return typeof value === 'string' && MOVEMENTS.includes(value);
}

/**
 * Every entry is a shipped token, or the whole list is refused.
 *
 * Order of checks is fixed so the reported reason is deterministic: the shape
 * first, then each entry in index order. A non-string and an unrecognized
 * string are reported apart, because they are different failures — the first
 * is a broken payload, the second a vocabulary mismatch.
 */
function requireTokens<T extends string>(
  values: unknown,
  vocabulary: readonly string[],
  field: WellnessSafetyInputField,
): readonly T[] {
  if (!Array.isArray(values)) throw new WellnessSafetyInputInvalid('not-an-array', field);
  for (const value of values) {
    if (typeof value !== 'string') throw new WellnessSafetyInputInvalid('not-a-string', field);
    if (!vocabulary.includes(value)) {
      throw new WellnessSafetyInputInvalid('unknown-token', field);
    }
  }
  return values as readonly T[];
}

/**
 * Analyze one wellness input.
 *
 * Deterministic by construction: both vocabularies are validated in a fixed
 * order, duplicates collapse, and the result is sorted lexicographically on
 * the ASCII tokens — so shuffling the input cannot change the output, and
 * running twice returns the same thing.
 *
 * **Fails closed.** A present input is validated in full: a malformed field or
 * an unknown token throws {@link WellnessSafetyInputInvalid} rather than
 * producing an empty — and therefore permissive — exclusion set. `null` /
 * `undefined` stays the valid absent case.
 *
 * `affectedAreas` is validated and then never read again: it cannot influence
 * a single output value.
 */
export function analyzeWellnessSafety(
  input: WellnessSafetyInput | null | undefined,
): WellnessSafetyAnalysis {
  // Absent, not malformed: no profile means no declared limitations.
  if (!input) return EMPTY_ANALYSIS;

  // Validated for trustworthiness, never for computation (Decision 4). The
  // return value is deliberately discarded — reading it below is what would
  // make the field non-inert.
  requireTokens<WellnessAffectedArea>(
    input.affectedAreas,
    WELLNESS_AFFECTED_AREAS,
    'affectedAreas',
  );

  const declared = requireTokens<WellnessMovementToAvoid>(
    input.movementsToAvoid,
    MOVEMENTS,
    'movementsToAvoid',
  );
  if (declared.length === 0) return EMPTY_ANALYSIS;

  // `evaluationCompleted` and `evaluationDate` are read nowhere: they are
  // records, never permissions (Decision 2).
  const excludedMovements = [...new Set(declared)].sort();
  return {
    excludedMovements,
    reasons: excludedMovements.map((movement) => ({
      code: WELLNESS_REASON_MOVEMENT_DECLARED,
      inputs: { movement },
      ruleVersion: ENGINE_RULE_VERSION,
    })),
  };
}

/**
 * True when `area` is a shipped affected-area token.
 *
 * Exposed so a caller can validate the inert field without importing the
 * vocabulary itself. It answers a membership question and nothing else — it
 * implies no exclusion, no severity and no clinical meaning.
 */
export function isWellnessAffectedArea(area: unknown): area is WellnessAffectedArea {
  return typeof area === 'string' && (WELLNESS_AFFECTED_AREAS as readonly string[]).includes(area);
}
