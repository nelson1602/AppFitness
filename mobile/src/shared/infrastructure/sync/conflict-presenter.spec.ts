import type { SyncConflictRow } from '../database/types';
import {
  buildConflictReview,
  SUPPORTED_PRESENTER_ENTITY_TYPES,
  type ConflictFieldComparison,
  type ConflictReview,
  type ConflictReviewModel,
} from './conflict-presenter';

/**
 * ADR-P030 §Decision 2 — the per-entity presenter allow-list.
 *
 * The invariant under test is containment: a surface may learn allow-listed
 * field identifiers and resolved values, and nothing else. Every escape route
 * the payload could take — raw JSON, ids, `user_id`, free text, ciphertext,
 * the `[REDACTED]` literal, an unknown column — is asserted closed.
 */

const NOW = '2026-09-14T10:00:00.000Z';

function conflict(overrides: Partial<SyncConflictRow> = {}): SyncConflictRow {
  return {
    id: 'conflict-1',
    user_id: 'user-a',
    entity_type: 'body_weights',
    entity_id: 'bw-1',
    local_payload: '{}',
    server_payload: '{}',
    base_version: 3,
    server_version: 5,
    status: 'PENDING',
    created_at: NOW,
    resolved_at: null,
    chosen_resolution: null,
    chosen_at: null,
    settlement_status: null,
    settlement_attempts: 0,
    next_attempt_at: null,
    last_error: null,
    last_failure_code: null,
    blocked_resolution: null,
    ...overrides,
  };
}

function review(
  entityType: string,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  overrides: Partial<SyncConflictRow> = {},
): ConflictReview {
  return buildConflictReview(conflict({ entity_type: entityType, ...overrides }), local, server);
}

function model(result: ConflictReview): ConflictReviewModel {
  if (result.status !== 'REVIEWABLE') throw new Error(`expected REVIEWABLE, got ${result.status}`);
  return result.model;
}

function field(result: ConflictReview, name: string): ConflictFieldComparison {
  const found = model(result).fields.find((row) => row.field === name);
  if (!found) throw new Error(`no field row for '${name}'`);
  return found;
}

// ── Registry parity ──────────────────────────────────────────────────────────

describe('the allow-list covers exactly the registered entity types', () => {
  /**
   * The registrars wired in `src/app/_layout.tsx`. `registerMedicalSyncAppliers`
   * exists but is deliberately NOT called, so medical has no applier and must
   * have no presenter either.
   */
  const REGISTERED = [
    'user_profiles',
    'goals',
    'meal_items',
    'dietary_preferences',
    'exercises',
    'routines',
    'workout_logs',
    'routine_exercises',
    'workout_sets',
    'body_weights',
    'body_measurements',
    'progress_snapshots',
    'wellness_safety_profiles',
  ];

  it('presents every registered entity type and nothing more', () => {
    expect([...SUPPORTED_PRESENTER_ENTITY_TYPES].sort()).toEqual([...REGISTERED].sort());
  });

  it.each(REGISTERED)('%s presents at least one comparable field', (entityType) => {
    const result = review(entityType, {}, {});
    expect(model(result).fields.length).toBeGreaterThan(0);
  });

  it.each(['medical_evaluations', 'medical_restrictions'])(
    '%s is unsupported, keeping the medical domain dormant',
    (entityType) => {
      expect(review(entityType, {}, {})).toEqual({
        status: 'UNSUPPORTED',
        entityKind: entityType,
        reason: 'UNKNOWN_ENTITY',
      });
    },
  );

  it('an entity type nobody registered is refused, not guessed', () => {
    expect(review('invoices', { total: 10 }, {})).toMatchObject({
      status: 'UNSUPPORTED',
      reason: 'UNKNOWN_ENTITY',
    });
  });
});

// ── Fail closed ──────────────────────────────────────────────────────────────

describe('the allow-list fails closed', () => {
  it('refuses the whole presentation when a payload carries an unknown key', () => {
    const result = review('body_weights', { weight_kg: 81, mood_score: 4 }, { weight_kg: 90 });

    expect(result).toEqual({
      status: 'UNSUPPORTED',
      entityKind: 'body_weights',
      reason: 'UNKNOWN_FIELD',
      field: 'mood_score',
    });
  });

  it('refuses when the unknown key is only on the server side', () => {
    const result = review('goals', { goal_type: 'FAT_LOSS' }, { goal_type: 'STRENGTH', streak: 4 });

    expect(result).toMatchObject({
      status: 'UNSUPPORTED',
      reason: 'UNKNOWN_FIELD',
      field: 'streak',
    });
  });

  it('accepts the structural columns every synced row carries', () => {
    const structural = {
      id: 'bw-1',
      user_id: 'user-a',
      version: 5,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
      deleted_by: null,
      sync_status: 'synced',
      sync_seq: 42,
      weight_kg: 81,
    };

    expect(review('body_weights', structural, structural).status).toBe('REVIEWABLE');
  });

  it('accepts an entity-specific parent id as structural', () => {
    const result = review(
      'meal_items',
      { meal_id: 'meal-1', food_id: 'food-1', serving_count: 2 },
      { serving_count: 3 },
    );

    expect(result.status).toBe('REVIEWABLE');
  });
});

// ── Nothing unsafe escapes ───────────────────────────────────────────────────

describe('nothing unsafe escapes the presenter', () => {
  it('never carries ids, the owner, or a raw payload', () => {
    const payload = {
      id: 'bw-1',
      user_id: 'user-a',
      weight_kg: 81,
      notes: 'felt awful, doctor said to rest',
    };
    const result = review('body_weights', payload, { ...payload, weight_kg: 90 });
    const serialized = JSON.stringify(model(result));

    expect(serialized).not.toContain('bw-1');
    expect(serialized).not.toContain('user-a');
    expect(serialized).not.toContain('doctor');
    expect(serialized).not.toContain('local_payload');
    expect(serialized).not.toContain('server_payload');
    // The conflict handle is the one identifier a surface needs to act.
    expect(model(result).conflictId).toBe('conflict-1');
  });

  it('never emits the redaction literal, even on an allow-listed field', () => {
    const result = review(
      'progress_snapshots',
      { rule_version: 'icoach-rules@1.1.0' },
      { rule_version: '[REDACTED]' },
    );

    expect(field(result, 'rule_version').server).toEqual({ state: 'hidden' });
    expect(JSON.stringify(model(result))).not.toContain('REDACTED');
  });

  it('never emits ciphertext: an envelope key is an unknown field', () => {
    // Decryption happens in the caller. If an envelope ever reached here it
    // would be refused outright rather than serialized.
    const result = review('meal_items', { __enc: 'CIPHERTEXT' }, {});

    expect(result).toMatchObject({
      status: 'UNSUPPORTED',
      reason: 'UNKNOWN_FIELD',
      field: '__enc',
    });
  });

  it('emits no localized wording — identifiers and values only', () => {
    const result = review(
      'goals',
      { goal_type: 'FAT_LOSS', is_active: 1 },
      { goal_type: 'STRENGTH' },
    );
    const serialized = JSON.stringify(model(result));

    // C-5 owns every user-facing string; nothing sentence-like may appear here.
    expect(serialized).not.toMatch(/[a-z] [a-z]+ [a-z]+ [a-z]/);
  });
});

// ── Free text is hidden, not emptied ─────────────────────────────────────────

describe('excluded values are hidden, never shown as empty', () => {
  it.each([
    ['body_weights', 'notes', { weight_kg: 81, notes: 'private' }],
    ['body_measurements', 'notes', { date: '2026-09-01', notes: 'private' }],
    ['workout_logs', 'notes', { name: 'Leg day', notes: 'private' }],
    ['workout_sets', 'notes', { set_number: 1, notes: 'private' }],
    ['exercises', 'instructions', { name: 'Squat', instructions: 'private' }],
    ['routines', 'description', { name: 'Push', description: 'private' }],
    ['user_profiles', 'occupation', { height_cm: 180, occupation: 'private' }],
    ['dietary_preferences', 'note', { kind: 'allergy', note: 'private' }],
    ['meal_items', 'food_name_snapshot', { serving_count: 1, food_name_snapshot: 'private' }],
  ])('%s hides %s while stating that a value exists', (entityType, name, payload) => {
    const result = review(entityType, payload, payload);

    expect(field(result, name).local).toEqual({ state: 'hidden' });
    expect(JSON.stringify(model(result))).not.toContain('private');
  });

  it('a genuinely empty excluded field reads as empty, not as hidden', () => {
    const result = review('body_weights', { weight_kg: 81, notes: null }, { weight_kg: 90 });

    expect(field(result, 'notes').local).toEqual({ state: 'value', value: null });
    // Absent on the other side: the server payload never carried the key.
    expect(field(result, 'notes').server).toEqual({ state: 'absent' });
  });

  it('distinguishes absent from empty on an allow-listed field', () => {
    const result = review('goals', { target_weight_kg: null }, {});

    expect(field(result, 'target_weight_kg').local).toEqual({ state: 'value', value: null });
    expect(field(result, 'target_weight_kg').server).toEqual({ state: 'absent' });
    expect(field(result, 'goal_type').local).toEqual({ state: 'absent' });
  });
});

// ── Values and comparison ────────────────────────────────────────────────────

describe('resolved values and comparison', () => {
  it('reports same, different and unknown without guessing', () => {
    const result = review(
      'body_weights',
      { date: '2026-09-01', weight_kg: 81, notes: 'x' },
      { date: '2026-09-01', weight_kg: 90 },
    );

    expect(field(result, 'date').comparison).toBe('same');
    expect(field(result, 'weight_kg').comparison).toBe('different');
    // One side hidden, the other absent — never asserted equal or different.
    expect(field(result, 'notes').comparison).toBe('unknown');
  });

  it('normalises SQLite 0/1 booleans against wire booleans', () => {
    const result = review('goals', { is_active: 1 }, { is_active: true });

    expect(field(result, 'is_active').local).toEqual({ state: 'value', value: true });
    expect(field(result, 'is_active').comparison).toBe('same');
  });

  it('reads token arrays from both the wire array and the stored JSON string', () => {
    const result = review(
      'user_profiles',
      { equipment: '["dumbbells","bands"]' },
      { equipment: ['dumbbells', 'bands'] },
    );

    expect(field(result, 'equipment').local).toEqual({
      state: 'value',
      value: ['dumbbells', 'bands'],
    });
    expect(field(result, 'equipment').comparison).toBe('same');
  });

  it('hides a value whose type contradicts its declared kind', () => {
    const result = review('body_weights', { weight_kg: 'eighty-one' }, { weight_kg: 90 });

    expect(field(result, 'weight_kg').local).toEqual({ state: 'hidden' });
  });

  it('resolves dietary-preference values once decrypted', () => {
    const result = review(
      'dietary_preferences',
      { exclusion_type: 'avoid_tag', avoid_tag: 'nut_allergy', kind: 'allergy', note: 'severe' },
      {
        exclusion_type: 'avoid_tag',
        avoid_tag: 'nut_allergy',
        kind: 'preference',
        note: '[REDACTED]',
      },
    );

    expect(field(result, 'avoid_tag').local).toEqual({ state: 'value', value: 'nut_allergy' });
    expect(field(result, 'kind').comparison).toBe('different');
    expect(field(result, 'note').local).toEqual({ state: 'hidden' });
    expect(field(result, 'note').server).toEqual({ state: 'hidden' });
  });

  it('resolves meal-item values while hiding the redacted food name', () => {
    const result = review(
      'meal_items',
      { meal_id: 'm1', food_id: 'f1', serving_count: 2 },
      {
        serving_count: 3,
        food_name_snapshot: '[REDACTED]',
        calories_per_serving_snapshot: 160,
      },
    );

    expect(field(result, 'serving_count').comparison).toBe('different');
    expect(field(result, 'calories_per_serving_snapshot').server).toEqual({
      state: 'value',
      value: 160,
    });
    expect(field(result, 'food_name_snapshot').server).toEqual({ state: 'hidden' });
  });
});

// ── Metadata ─────────────────────────────────────────────────────────────────

describe('permitted metadata', () => {
  it('carries the entity kind, versions and the age basis', () => {
    const result = review('body_weights', { date: '2026-09-01' }, { date: '2026-09-01' });

    expect(model(result)).toMatchObject({
      entityKind: 'body_weights',
      baseVersion: 3,
      currentServerVersion: 5,
      detectedAt: NOW,
      comparisonDate: '2026-09-01',
    });
  });

  it('prefers the server side for the comparison date basis', () => {
    const result = review('body_weights', { date: '2026-09-01' }, { date: '2026-09-04' });

    expect(model(result).comparisonDate).toBe('2026-09-04');
  });

  it('falls back to the local side when the server omits the date', () => {
    const result = review('body_weights', { date: '2026-09-01' }, {});

    expect(model(result).comparisonDate).toBe('2026-09-01');
  });

  it('reports no date basis for an entity that has none', () => {
    expect(model(review('user_profiles', {}, {})).comparisonDate).toBeNull();
  });

  it.each([
    ['UNDECIDED', {}],
    ['CHOICE_RECORDED', { chosen_resolution: 'RESOLVED_LOCAL_WINS', settlement_status: 'PENDING' }],
    [
      'CHOICE_RECORDED',
      { chosen_resolution: 'RESOLVED_LOCAL_WINS', settlement_status: 'IN_FLIGHT' },
    ],
    ['RETRYING', { chosen_resolution: 'RESOLVED_LOCAL_WINS', settlement_status: 'FAILED' }],
    [
      'BLOCKED',
      { blocked_resolution: 'RESOLVED_LOCAL_WINS', last_failure_code: 'RESTORE_UNSUPPORTED' },
    ],
    ['SETTLED', { chosen_resolution: 'RESOLVED_SERVER_WINS', settlement_status: 'SETTLED' }],
  ])('reports the %s settlement condition', (expected, overrides) => {
    const result = review('body_weights', {}, {}, overrides as Partial<SyncConflictRow>);

    expect(model(result).settlement).toBe(expected);
  });
});
