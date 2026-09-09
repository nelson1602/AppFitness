import type { MovementPattern } from '@/features/workout/domain/exercise-catalog';

/**
 * Wellness Safety Profile contract (ADR-P017 **W-1**).
 *
 * A wellness-owned, per-user, synchronizable aggregate holding the minimum the
 * owner clarification permits: whether a professional physical evaluation was
 * completed and when, plus self-declared physical limitations as structured
 * language-neutral tokens.
 *
 * ── What this deliberately is NOT ───────────────────────────────────────────
 * It carries no provider identity, no evaluation results or findings, no
 * clearance status, no diagnosis, no named condition, no medication, no
 * treatment, no blood pressure, no rehabilitation instruction, no symptom, no
 * severity, no dosage, no supplement data, no document and no free-text note.
 * Recording *that* an evaluation happened is not recording its contents
 * (ADR-P017 Owner Clarification 2026-09-08). The absence of any free-text
 * column is what makes accidental collection of a clinical narrative
 * impossible rather than merely discouraged.
 *
 * It is also **not** the retained medical model: `MedicalRestriction`, its
 * enums, its table, its columns and its rows are untouched and stay dormant
 * under ADR-0011 / P001 / P006 / P011. This contract reuses none of them.
 *
 * ── Scope of W-1 ────────────────────────────────────────────────────────────
 * Contract and storage only. There is no repository, store, sync handler,
 * entity registration, endpoint, UI or iCoach consumption here: W-2 owns
 * read/write and sync, W-3 the onboarding capture surface and its copy, and
 * W-4 the deterministic consumption that may conservatively exclude movements
 * or lower workload. None of them is authorized by W-1.
 */

/** Bump when the token vocabularies or field set change (W-2+ consumers pin it). */
export const WELLNESS_SAFETY_PROFILE_CONTRACT_VERSION = 'wellness-safety-profile@1.0.0';

/**
 * Fixed, anatomical affected-area vocabulary.
 *
 * Anatomical and non-diagnostic by construction: a **region of the body**,
 * never a condition, injury type, severity or cause. It is a **new
 * wellness-owned** vocabulary — `BODY_AREA_EXCLUSIONS` in the iCoach
 * restriction analyzer is keyed off retained `MedicalRestriction.bodyArea`
 * values and is not reused here, and no area-to-movement mapping exists in W-1
 * (that is W-4's, and it must stay conservative and versioned).
 *
 * It covers the regions the shipped exercise catalog can actually load, so a
 * user is not forced to approximate. `head` is deliberately **excluded**: a
 * head-related concern belongs with a qualified professional, not in a
 * deterministic exercise mapping, and offering it would invite exactly the
 * clinical input public V1 does not collect. Widening the set is a deliberate
 * contract change with its own review, not an implementation detail — and it
 * needs a new forward-only migration on both sides, because both databases
 * enforce this list.
 */
export const WELLNESS_AFFECTED_AREAS = [
  'abdomen',
  'ankle',
  'chest',
  'elbow',
  'foot',
  'forearm',
  'groin',
  'hand',
  'hip',
  'knee',
  'lower_back',
  'lower_leg',
  'neck',
  'shoulder',
  'thigh',
  'upper_arm',
  'upper_back',
  'wrist',
] as const;

export type WellnessAffectedArea = (typeof WELLNESS_AFFECTED_AREAS)[number];

/**
 * Movements a user may declare they want to avoid.
 *
 * These are **not a parallel identifier system**: they are exactly the union of
 * `movementPatterns` declared by the shipped built-in exercise catalog
 * (`features/workout/infrastructure/exercise-catalog.data.ts`), which is itself
 * a subset of the deterministic engine's `excludedMovements` vocabulary. A
 * token that no shipped exercise declares could never match anything, so it is
 * not offered: `behind_neck_press` exists in the `MovementPattern` type but is
 * declared by no built-in exercise, and is therefore absent here.
 *
 * `wellness-safety-profile.spec.ts` recomputes the union from the catalog data
 * and fails if the two diverge, so a catalog change forces a deliberate
 * vocabulary decision instead of silently stranding or inventing a token. The
 * `satisfies` clause additionally proves at compile time that every token is a
 * catalog `MovementPattern`, and the same spec proves the PostgreSQL and SQLite
 * allowlists are exactly this list — a catalog change therefore also requires a
 * new forward-only migration on both sides.
 */
export const WELLNESS_MOVEMENTS_TO_AVOID = [
  'bridging',
  'deep_squat',
  'dips',
  'front_rack_loading',
  'good_morning',
  'heavy_hinge',
  'heavy_pressing',
  'high_impact_cardio',
  'jumping',
  'loaded_carries',
  'loaded_spinal_flexion',
  'lunge',
  'max_effort_lifts',
  'overhead_press',
  'running',
  'skull_crushers',
  'sprinting',
  'valsalva_heavy_lifts',
] as const satisfies readonly MovementPattern[];

export type WellnessMovementToAvoid = (typeof WELLNESS_MOVEMENTS_TO_AVOID)[number];

/**
 * Upper bound on either token list, enforced by both databases.
 *
 * Both vocabularies are closed and small, so a list longer than this cannot be
 * a legitimate selection — it is either a bug or an attempt to use the row as
 * unbounded storage for sensitive text. The bound is a structural guard, not a
 * product rule.
 */
export const WELLNESS_TOKEN_LIST_MAX = 64;

/**
 * The aggregate.
 *
 * One atomic future sync entity: the flag, the date and both token lists live
 * in a single row, so a device can never publish "evaluation completed" and its
 * limitations as two independently ordered changes. Tokens are stored inline
 * (PostgreSQL `text[]`, SQLite JSON-array `TEXT`) rather than as child rows —
 * child entities per token would multiply the sync surface and make the
 * aggregate non-atomic for no gain, since a token carries no state of its own.
 *
 * Sensitivity: self-declared limitations are wellness data of the same class as
 * an ADR-P014 `dietary_preferences` allergy token and an ADR-P016 body metric,
 * both of which already ship as structured plaintext tokens/values with only
 * free text encrypted (`note_enc`). W-1 follows that precedent exactly and goes
 * one step further by having no free-text column at all. This does **not**
 * reclassify the dormant medical information, which keeps its own encrypted
 * columns and protections. These tokens are user-visible content, never
 * operational metadata: they must never be logged, attached to Sentry, or put
 * in an audit payload (`.ai/05_SECURITY.md` §Logging).
 */
export interface WellnessSafetyProfile {
  /** Client-generatable UUID; the same row id on device and server. */
  readonly id: string;
  /**
   * Authenticated owner.
   *
   * Ownership is **structurally represented and cascade-protected**: the column
   * is `NOT NULL`, references the account, and the row is erased with it. That
   * is not access control — a query by `id` alone would still read another
   * user's row. Enforcing isolation is **W-2's obligation**: every read, write,
   * delete, dirty-row scan, push and pull must carry the authenticated
   * `user_id` predicate, and W-2 must ship explicit cross-user denial tests.
   */
  readonly userId: string;
  /** Whether the user reports having completed a professional evaluation. */
  readonly evaluationCompleted: boolean;
  /** Calendar date `YYYY-MM-DD`, or null when no evaluation is reported. */
  readonly evaluationDate: string | null;
  /** Self-declared affected areas. Empty array, never null. */
  readonly affectedAreas: readonly WellnessAffectedArea[];
  /** Self-declared movements to avoid. Empty array, never null. */
  readonly movementsToAvoid: readonly WellnessMovementToAvoid[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
}

/*
 * ── Invariants ──────────────────────────────────────────────────────────────
 * What both databases enforce, restated here as the single contract record.
 * W-1 ships the constraints; the behaviour that satisfies them is W-2/W-3
 * work.
 *
 * 1. **Zero or one active profile per user** — a partial unique index on
 *    `(user_id) WHERE deleted_at IS NULL` on both sides. Tombstones may
 *    accumulate for sync; at most one live row can exist.
 * 2. **`evaluationCompleted === false` requires `evaluationDate === null`**,
 *    and `true` requires a non-null date. A database CHECK on both sides.
 * 3. **A future date is NOT rejected by the database.** "Not in the future"
 *    depends on the current clock, so enforcing it in a CHECK would let a
 *    stored row's validity change over time and could reject a legitimate
 *    entry across time zones. It is **application validation owned by
 *    W-2/W-3**. PostgreSQL still guarantees a real calendar date through its
 *    `DATE` type; SQLite validates the `YYYY-MM-DD` shape with a deterministic
 *    `GLOB`, leaving calendar validity (e.g. 2026-02-31) to the same
 *    application boundary.
 * 4. **Limitations are independent of evaluation completion** — a user may
 *    declare areas or movements without any evaluation, and may report a
 *    completed evaluation with no limitations. No CHECK couples them.
 * 5. **Arrays default to empty and are never null**, bounded by
 *    {@link WELLNESS_TOKEN_LIST_MAX}.
 * 6. **Only tokens from these two vocabularies can be stored — enforced by
 *    both databases**, not by convention. PostgreSQL requires each array to be
 *    contained by its explicit allowed-token array (`<@`); SQLite validates
 *    every element with named `BEFORE INSERT` / `BEFORE UPDATE` triggers over
 *    `json_each`, rejecting any element that is not JSON text or is outside the
 *    allowed set. So an unknown token, an uppercase variant, a blank string, a
 *    number, a boolean, `null`, a nested array/object — and any clinical
 *    sentence, however lowercase — is refused at the storage boundary. That is
 *    what makes "no free text" a guarantee rather than an aspiration: the
 *    column set carries no free-text field and the two token columns are
 *    allowlisted.
 * 7. **Tokens are stable, lowercase and language-neutral.** Presentation labels
 *    (EN/ES) belong to W-3 and never reach storage.
 * 8. **Normalization stays at the application boundary** — trim, lowercase,
 *    deduplicate and sort, deterministically, before a write. W-1 introduces no
 *    repository behaviour, so this is stated, not implemented; W-2 owns it. The
 *    databases reject an invalid token, but they neither reorder nor
 *    de-duplicate a valid one.
 *
 * A vocabulary change is therefore a schema change: a new forward-only
 * migration on both sides, alongside the contract edit. That cost is
 * deliberate — an unenforced initial contract would be the greater risk.
 */
