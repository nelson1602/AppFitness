import type { SyncConflictRow } from '../database/types';

/**
 * Per-entity presenter allow-list — ADR-P030 §Decision 2, slice C-4.
 *
 * A conflict is presented as **entity-typed, field-level rows drawn through an
 * allow-list**, never by handing `local_payload` / `server_payload` to a
 * surface. A-3 proves the payload shape is neither uniform nor fully trusted,
 * so the list fails **closed**: an unknown entity, or a key no entry accounts
 * for, refuses the whole presentation rather than leaking whatever arrived.
 *
 * What can never leave this module:
 *
 * - raw payloads, whole-payload JSON, ids, `user_id`, tokens or ciphertext;
 * - free text — `notes` and equivalents are excluded outright, and for the
 *   entities the server redacts, the literal `[REDACTED]` would otherwise be
 *   shown as if it were the user's own data;
 * - localized wording. Every identifier here is **copy-neutral**: C-5 owns the
 *   EN/ES labels these keys select, and C-6 owns the screen.
 *
 * Ambiguity is stated rather than implied: a field that exists but may not be
 * shown reports `hidden`, which a surface must render as "a value exists and is
 * not shown" — never as empty.
 */

/** How a value may be rendered. An identifier for C-5's formatter, not copy. */
export type ConflictFieldKind =
  'number' | 'text' | 'date' | 'timestamp' | 'boolean' | 'enum' | 'tokens';

export type ConflictFieldValue =
  /** Carried by this side. `null` is a real, empty value. */
  | {
      readonly state: 'value';
      readonly value: string | number | boolean | readonly string[] | null;
    }
  /** Carried by this side, but excluded from display. NOT empty. */
  | { readonly state: 'hidden' }
  /** Not carried by this side at all (e.g. a partial UPDATE, or a DELETE). */
  | { readonly state: 'absent' };

export type ConflictFieldComparison = {
  /** Stable, copy-neutral identifier. C-5 keys its label from this. */
  readonly field: string;
  readonly kind: ConflictFieldKind;
  readonly local: ConflictFieldValue;
  readonly server: ConflictFieldValue;
  /** `unknown` whenever either side is hidden or absent — never guessed. */
  readonly comparison: 'same' | 'different' | 'unknown';
};

/** The lifecycle condition a surface reports, from §Decision 6's outbox. */
export type SettlementCondition =
  'UNDECIDED' | 'CHOICE_RECORDED' | 'RETRYING' | 'BLOCKED' | 'SETTLED';

export interface ConflictReviewModel {
  /** The handle a surface acts on. Not entity data: no entity or owner id. */
  readonly conflictId: string;
  /** Copy-neutral entity identifier (e.g. `body_weights`). C-5 labels it. */
  readonly entityKind: string;
  /**
   * The entity's own date, when it has one — the basis a surface words as
   * "the entry for <date>". Null for entities with no event date.
   */
  readonly comparisonDate: string | null;
  /** The version the local edit was based on. */
  readonly baseVersion: number;
  /** The server version currently under comparison. */
  readonly currentServerVersion: number;
  /** When the divergence was recorded. C-5/C-6 compute and word the age. */
  readonly detectedAt: string;
  readonly settlement: SettlementCondition;
  readonly fields: readonly ConflictFieldComparison[];
}

export type PresenterRefusal = 'UNKNOWN_ENTITY' | 'UNKNOWN_FIELD' | 'MALFORMED_PAYLOAD';

export type ConflictReview =
  | { readonly status: 'REVIEWABLE'; readonly model: ConflictReviewModel }
  | {
      readonly status: 'UNSUPPORTED';
      readonly entityKind: string;
      readonly reason: PresenterRefusal;
      /** The key that failed the allow-list, when that is what refused it. */
      readonly field?: string;
    };

// ── The allow-list ───────────────────────────────────────────────────────────

interface FieldSpec {
  readonly field: string;
  readonly kind: ConflictFieldKind;
}

interface EntityPresenter {
  /** Shown, in this order. */
  readonly fields: readonly FieldSpec[];
  /**
   * Known and deliberately not shown. Free text, and everything the server
   * may return as the literal `[REDACTED]`. Their presence is still reported
   * as `hidden`, so the user is told a value exists.
   */
  readonly hidden: readonly string[];
  /** The key carrying this entity's own date basis, if it has one. */
  readonly dateBasis?: string;
}

/**
 * Identity, ownership and housekeeping columns. Known, and dropped entirely
 * rather than reported as `hidden`: they are not fields the user decided
 * anything about, and ids and `user_id` must never be shown at all.
 */
const STRUCTURAL_KEYS: readonly string[] = [
  'id',
  'user_id',
  'version',
  'created_at',
  'updated_at',
  'deleted_at',
  'deleted_by',
  'sync_status',
  'sync_seq',
  'enc_key_id',
  'created_by',
];

/**
 * The registered, supported entity types — read off the `registerApplier`
 * call sites wired in `src/app/_layout.tsx`. The medical registrar exists but
 * is **never invoked**, so `medical_evaluations` / `medical_restrictions` have
 * no applier, are absent here, and refuse as `UNKNOWN_ENTITY`. That is what
 * keeps the medical domain dormant (ADR-P017 / §Decision 12).
 */
const PRESENTERS: Readonly<Record<string, EntityPresenter>> = {
  user_profiles: {
    fields: [
      { field: 'birth_date', kind: 'date' },
      { field: 'gender', kind: 'enum' },
      { field: 'height_cm', kind: 'number' },
      { field: 'fitness_level', kind: 'enum' },
      { field: 'years_training', kind: 'number' },
      { field: 'activity_level', kind: 'enum' },
      { field: 'sleep_hours_baseline', kind: 'number' },
      { field: 'stress_level_baseline', kind: 'number' },
      { field: 'equipment', kind: 'tokens' },
      { field: 'training_days_per_week', kind: 'number' },
      { field: 'session_duration_mins', kind: 'number' },
      { field: 'target_calories', kind: 'number' },
      { field: 'target_protein_g', kind: 'number' },
      { field: 'target_carbs_g', kind: 'number' },
      { field: 'target_fat_g', kind: 'number' },
    ],
    hidden: ['occupation'],
  },
  goals: {
    fields: [
      { field: 'goal_type', kind: 'enum' },
      { field: 'target_weight_kg', kind: 'number' },
      { field: 'target_date', kind: 'date' },
      { field: 'is_active', kind: 'boolean' },
      { field: 'started_at', kind: 'timestamp' },
      { field: 'ended_at', kind: 'timestamp' },
    ],
    hidden: [],
    dateBasis: 'started_at',
  },
  body_weights: {
    fields: [
      { field: 'date', kind: 'date' },
      { field: 'weight_kg', kind: 'number' },
    ],
    hidden: ['notes'],
    dateBasis: 'date',
  },
  body_measurements: {
    fields: [
      { field: 'date', kind: 'date' },
      { field: 'body_fat_pct', kind: 'number' },
      { field: 'muscle_mass_kg', kind: 'number' },
      { field: 'waist_cm', kind: 'number' },
      { field: 'hip_cm', kind: 'number' },
      { field: 'chest_cm', kind: 'number' },
      { field: 'left_arm_cm', kind: 'number' },
      { field: 'right_arm_cm', kind: 'number' },
      { field: 'neck_cm', kind: 'number' },
    ],
    hidden: ['notes'],
    dateBasis: 'date',
  },
  progress_snapshots: {
    fields: [
      { field: 'week_start', kind: 'date' },
      { field: 'avg_weight_kg', kind: 'number' },
      { field: 'total_volume_kg', kind: 'number' },
      { field: 'avg_calories', kind: 'number' },
      { field: 'workout_count', kind: 'number' },
      { field: 'is_deload_week', kind: 'boolean' },
      { field: 'rule_version', kind: 'text' },
    ],
    hidden: [],
    dateBasis: 'week_start',
  },
  dietary_preferences: {
    fields: [
      { field: 'exclusion_type', kind: 'enum' },
      { field: 'avoid_tag', kind: 'text' },
      { field: 'catalog_key', kind: 'text' },
      { field: 'kind', kind: 'enum' },
    ],
    // Encrypted at rest and `[REDACTED]` on the server side (A-4).
    hidden: ['note'],
  },
  meal_items: {
    fields: [
      { field: 'serving_count', kind: 'number' },
      { field: 'serving_amount_snapshot', kind: 'number' },
      { field: 'serving_unit_snapshot', kind: 'text' },
      { field: 'grams_per_serving_snapshot', kind: 'number' },
      { field: 'calories_per_serving_snapshot', kind: 'number' },
      { field: 'protein_per_serving_snapshot', kind: 'number' },
      { field: 'carbs_per_serving_snapshot', kind: 'number' },
      { field: 'fat_per_serving_snapshot', kind: 'number' },
      { field: 'fiber_per_serving_snapshot', kind: 'number' },
      { field: 'catalog_key_snapshot', kind: 'text' },
      { field: 'food_revision_snapshot', kind: 'number' },
      { field: 'catalog_version_snapshot', kind: 'text' },
    ],
    // `food_name_snapshot` is redacted server-side; `meal_id` / `food_id` are
    // ids and are dropped as structural.
    hidden: ['food_name_snapshot', 'notes'],
  },
  exercises: {
    fields: [
      { field: 'name', kind: 'text' },
      { field: 'muscle_group', kind: 'text' },
      { field: 'category', kind: 'enum' },
    ],
    hidden: ['instructions'],
  },
  routines: {
    fields: [{ field: 'name', kind: 'text' }],
    hidden: ['description'],
  },
  routine_exercises: {
    fields: [
      { field: 'order_index', kind: 'number' },
      { field: 'target_sets', kind: 'number' },
      { field: 'target_reps', kind: 'number' },
      { field: 'target_weight_kg', kind: 'number' },
    ],
    hidden: [],
  },
  workout_logs: {
    fields: [
      { field: 'name', kind: 'text' },
      { field: 'started_at', kind: 'timestamp' },
      { field: 'finished_at', kind: 'timestamp' },
    ],
    hidden: ['notes'],
    dateBasis: 'started_at',
  },
  workout_sets: {
    fields: [
      { field: 'set_number', kind: 'number' },
      { field: 'reps', kind: 'number' },
      { field: 'weight_kg', kind: 'number' },
      { field: 'rpe', kind: 'number' },
      { field: 'completed', kind: 'boolean' },
    ],
    hidden: ['notes'],
  },
  wellness_safety_profiles: {
    fields: [
      { field: 'evaluation_completed', kind: 'boolean' },
      { field: 'evaluation_date', kind: 'date' },
      { field: 'affected_areas', kind: 'tokens' },
      { field: 'movements_to_avoid', kind: 'tokens' },
    ],
    hidden: [],
    dateBasis: 'evaluation_date',
  },
};

/**
 * `routine_exercises` and `meal_items` reference their parents by id. Those
 * are structural for presentation purposes and never rendered.
 */
const ENTITY_STRUCTURAL_KEYS: Readonly<Record<string, readonly string[]>> = {
  routine_exercises: ['routine_id', 'exercise_id'],
  workout_sets: ['workout_log_id', 'exercise_id'],
  workout_logs: ['routine_id'],
  meal_items: ['meal_id', 'food_id'],
};

/** Exported for the scope spec, which checks the list against the registry. */
export const SUPPORTED_PRESENTER_ENTITY_TYPES: readonly string[] = Object.keys(PRESENTERS);

// ── Value reading ────────────────────────────────────────────────────────────

/**
 * The literal a redacting server substitutes for free text. It must never be
 * surfaced as if it were the user's value — if one reaches an allow-listed
 * field, the field reports `hidden` instead.
 */
const REDACTION_LITERAL = '[REDACTED]';

function isStructural(entityType: string, key: string): boolean {
  return STRUCTURAL_KEYS.includes(key) || (ENTITY_STRUCTURAL_KEYS[entityType] ?? []).includes(key);
}

/** JSON-array columns arrive as an array (wire) or a JSON string (local row). */
function readTokens(raw: unknown): readonly string[] | null {
  const source: unknown = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!Array.isArray(source)) return null;
  return source.filter((item): item is string => typeof item === 'string');
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readValue(payload: Record<string, unknown>, spec: FieldSpec): ConflictFieldValue {
  if (!(spec.field in payload)) return { state: 'absent' };
  const raw = payload[spec.field];
  if (raw === null || raw === undefined) return { state: 'value', value: null };
  // Defence in depth: a redacted literal is never passed off as a real value.
  if (raw === REDACTION_LITERAL) return { state: 'hidden' };

  switch (spec.kind) {
    case 'tokens': {
      const tokens = readTokens(raw);
      return tokens ? { state: 'value', value: tokens } : { state: 'hidden' };
    }
    case 'boolean':
      // SQLite stores booleans as 0/1; the wire shape may send either.
      return { state: 'value', value: raw === true || raw === 1 };
    case 'number':
      return typeof raw === 'number' ? { state: 'value', value: raw } : { state: 'hidden' };
    default:
      return typeof raw === 'string' ? { state: 'value', value: raw } : { state: 'hidden' };
  }
}

/** A hidden field still reports that a value exists — never that it is empty. */
function readHidden(payload: Record<string, unknown>, field: string): ConflictFieldValue {
  if (!(field in payload)) return { state: 'absent' };
  const raw = payload[field];
  // Genuinely empty is a fact worth stating; only a real value is "hidden".
  return raw === null || raw === undefined ? { state: 'value', value: null } : { state: 'hidden' };
}

function compare(
  local: ConflictFieldValue,
  server: ConflictFieldValue,
): ConflictFieldComparison['comparison'] {
  if (local.state !== 'value' || server.state !== 'value') return 'unknown';
  const a = local.value;
  const b = server.value;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]) ? 'same' : 'different';
  }
  return a === b ? 'same' : 'different';
}

// ── Metadata ─────────────────────────────────────────────────────────────────

function settlementCondition(row: SyncConflictRow): SettlementCondition {
  if (row.settlement_status === 'SETTLED') return 'SETTLED';
  if (row.blocked_resolution !== null && row.chosen_resolution === null) return 'BLOCKED';
  if (row.settlement_status === 'FAILED') return 'RETRYING';
  if (row.chosen_resolution !== null) return 'CHOICE_RECORDED';
  return 'UNDECIDED';
}

function comparisonDate(
  presenter: EntityPresenter,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
): string | null {
  const key = presenter.dateBasis;
  if (!key) return null;
  // The server side is authoritative for the comparison; the local edit is the
  // fallback when the server row does not carry the key.
  for (const source of [server, local]) {
    const raw = source[key];
    if (typeof raw === 'string' && raw !== REDACTION_LITERAL) return raw;
  }
  return null;
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Builds the safe review model for one conflict from its **already decrypted**
 * payloads. Decryption happens in the caller, below presentation, so no
 * ciphertext ever reaches this function or its output (A-4).
 *
 * Fails closed: an entity with no presenter, or a payload key that is neither
 * allow-listed, hidden nor structural, refuses the whole presentation.
 */
export function buildConflictReview(
  row: SyncConflictRow,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
): ConflictReview {
  const presenter = PRESENTERS[row.entity_type];
  if (!presenter) {
    return { status: 'UNSUPPORTED', entityKind: row.entity_type, reason: 'UNKNOWN_ENTITY' };
  }

  const known = new Set<string>([
    ...presenter.fields.map((spec) => spec.field),
    ...presenter.hidden,
  ]);
  // An allow-list is only fail-closed if an unaccounted key stops it. A new
  // column on either side lands here rather than being quietly dropped.
  for (const payload of [local, server]) {
    for (const key of Object.keys(payload)) {
      if (known.has(key) || isStructural(row.entity_type, key)) continue;
      return {
        status: 'UNSUPPORTED',
        entityKind: row.entity_type,
        reason: 'UNKNOWN_FIELD',
        field: key,
      };
    }
  }

  const fields: ConflictFieldComparison[] = [
    ...presenter.fields.map((spec) => {
      const localValue = readValue(local, spec);
      const serverValue = readValue(server, spec);
      return {
        field: spec.field,
        kind: spec.kind,
        local: localValue,
        server: serverValue,
        comparison: compare(localValue, serverValue),
      };
    }),
    ...presenter.hidden.map((field) => {
      const localValue = readHidden(local, field);
      const serverValue = readHidden(server, field);
      return {
        field,
        kind: 'text' as const,
        local: localValue,
        server: serverValue,
        comparison: compare(localValue, serverValue),
      };
    }),
  ];

  return {
    status: 'REVIEWABLE',
    model: {
      conflictId: row.id,
      entityKind: row.entity_type,
      comparisonDate: comparisonDate(presenter, local, server),
      baseVersion: row.base_version,
      currentServerVersion: row.server_version,
      detectedAt: row.created_at,
      settlement: settlementCondition(row),
      fields,
    },
  };
}
