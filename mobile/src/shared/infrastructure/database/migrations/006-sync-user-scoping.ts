import type { Migration } from './index';

/**
 * Per-user scoping for the three local sync tables, plus the dormant
 * resolution-outbox columns (ADR-P030 Decisions 8 and 6, slice C-1).
 *
 * `sync_queue`, `sync_conflicts` and `sync_state` shipped without a `user_id`,
 * and `signOut()` deliberately preserves the database — so after a sign-out and
 * a second sign-in as a different account, that account's dashboard counted the
 * first account's conflicts and the worker would have pushed the first
 * account's queued ops under the second account's JWT.
 *
 * Wipe-on-sign-out was rejected: it would discard un-synced offline work,
 * trading a confidentiality bug for a data-loss one.
 *
 * ── Quarantine ──────────────────────────────────────────────────────────────
 * Rows whose owner cannot be proven are given `user_id = NULL`, NOT a sentinel
 * string. Every scoped read is `WHERE user_id = :sessionUserId`, and in SQL
 * `NULL = <anything>` is never true, so a quarantined row cannot be returned to
 * any authenticated session **by the semantics of the comparison** rather than
 * by a naming convention. NULL is also FK-legal: `PRAGMA foreign_keys = ON` is
 * set, and SQLite does not enforce a foreign key when the child column is NULL,
 * so the reference to `local_user(id)` is declared without excluding them.
 * They are retained indefinitely (ADR-P030 Decision 14); any purge needs its
 * own authorization.
 *
 * ── Backfill ────────────────────────────────────────────────────────────────
 * A queue/conflict row is attributed from **its own entity table** — matched on
 * `entity_type` AND `entity_id`, per ADR-P030 Decision 8 ("in its entity
 * table"). Matching on `entity_id` alone would let an unrelated row that merely
 * shares an id decide the owner, and `id` is only unique *within* a table.
 * Anything unmatched, owner-less or of an unrecognised `entity_type` is
 * quarantined. Ownership is never guessed.
 *
 * ── Cursors ─────────────────────────────────────────────────────────────────
 * `sync_state` is rebuilt with `(user_id, entity_type)` as its primary key.
 * Cursors are NOT backfilled: a cursor is a claim about what a *user* has
 * already seen, and the existing global rows cannot be attributed to one. Every
 * user therefore starts at 0, which is safe by construction — a from-scratch
 * pull re-applies rows the client already has (`INSERT OR REPLACE`), and
 * `hasPendingOpFor` (with BUG-014 fixed) protects un-pushed local edits,
 * including parked `CONFLICT` work. Because no cursor row is ever quarantined,
 * `sync_state.user_id` is `NOT NULL` and its composite key never holds a NULL.
 *
 * ── Resolution outbox (dormant) ─────────────────────────────────────────────
 * ADR-P030 Decision 6 places the durable resolution outbox on `sync_conflicts`
 * in **this** migration. A shipped migration can never be edited
 * (`.ai/04_DATABASE.md`), so the columns are pre-provisioned here even though
 * **slice C-4 owns every behaviour that uses them**. Nothing in this slice
 * reads or writes them: they are nullable (or defaulted), so every existing
 * row and every row C-1 writes is valid without mentioning them.
 *
 * Additive and forward-only; migrations 001–005 are untouched
 * (`.ai/04_DATABASE.md`). The whole migration runs inside the runner's
 * exclusive transaction, so it applies whole or not at all.
 */

/**
 * Where each synchronized `entity_type` proves its owner.
 *
 * `entityType` is the literal written into `sync_queue.entity_type` /
 * `sync_conflicts.entity_type` by the repositories; `table` is the entity table
 * it names; `ownerColumn` is that table's owner column. **These are not
 * interchangeable**: `exercises` is a catalog table with no `user_id` at all —
 * a custom exercise is owned through `created_by`, and a built-in has
 * `created_by IS NULL` and therefore no owner to find.
 *
 * Keeping the owner column explicit also removes a silent failure mode: an
 * unqualified `user_id` inside a sub-select over a table that lacks it does not
 * raise — SQLite resolves the name outward to the UPDATE target's own
 * `user_id`. `006-sync-user-scoping.spec.ts` asserts every entry's owner column
 * actually exists on its table, so the mapping cannot rot into that.
 */
interface EntityOwnership {
  readonly entityType: string;
  readonly table: string;
  readonly ownerColumn: string;
}

const ENTITY_OWNERSHIP: readonly EntityOwnership[] = [
  { entityType: 'user_profiles', table: 'user_profiles', ownerColumn: 'user_id' },
  { entityType: 'goals', table: 'goals', ownerColumn: 'user_id' },
  { entityType: 'medical_evaluations', table: 'medical_evaluations', ownerColumn: 'user_id' },
  { entityType: 'medical_restrictions', table: 'medical_restrictions', ownerColumn: 'user_id' },
  { entityType: 'body_weights', table: 'body_weights', ownerColumn: 'user_id' },
  { entityType: 'body_measurements', table: 'body_measurements', ownerColumn: 'user_id' },
  { entityType: 'progress_snapshots', table: 'progress_snapshots', ownerColumn: 'user_id' },
  // Catalog table: ownership is `created_by`, and built-ins have none.
  { entityType: 'exercises', table: 'exercises', ownerColumn: 'created_by' },
  { entityType: 'routines', table: 'routines', ownerColumn: 'user_id' },
  { entityType: 'routine_exercises', table: 'routine_exercises', ownerColumn: 'user_id' },
  { entityType: 'workout_logs', table: 'workout_logs', ownerColumn: 'user_id' },
  { entityType: 'workout_sets', table: 'workout_sets', ownerColumn: 'user_id' },
  { entityType: 'meal_items', table: 'meal_items', ownerColumn: 'user_id' },
  { entityType: 'dietary_preferences', table: 'dietary_preferences', ownerColumn: 'user_id' },
];

/** Exported for the migration spec, which checks the mapping against the schema. */
export const SYNC_ENTITY_OWNERSHIP = ENTITY_OWNERSHIP;

/**
 * `(entity_type, entity_id, owner_id)` over every synchronized entity table.
 * Each branch tags its rows with its own literal `entity_type`, so a match
 * requires the type as well as the id. `owner_id` is an alias no sync table
 * has, so the outer references below cannot bind to anything else.
 */
const OWNERSHIP_UNION = ENTITY_OWNERSHIP.map(
  ({ entityType, table, ownerColumn }) =>
    `SELECT '${entityType}' AS entity_type, id AS entity_id, ${ownerColumn} AS owner_id FROM ${table}`,
).join(' UNION ALL ');

/**
 * Attribute rows in `table` whose `(entity_type, entity_id)` resolves to
 * exactly ONE owner. Rows matching zero owners — orphaned, owner-less, or of an
 * unrecognised entity type — are left NULL, i.e. quarantined. `COUNT(DISTINCT)`
 * ignores NULLs, so a built-in exercise contributes no owner and quarantines.
 *
 * The `= 1` guard is kept even though `id` is each table's PRIMARY KEY (so a
 * type-qualified match can return at most one row): it is what makes the
 * statement fail **closed** rather than depend on that invariant holding.
 */
function backfillOwner(table: string): string {
  return `UPDATE ${table}
     SET user_id = (
       SELECT o.owner_id FROM (${OWNERSHIP_UNION}) AS o
       WHERE o.entity_type = ${table}.entity_type
         AND o.entity_id = ${table}.entity_id
     )
   WHERE (
     SELECT COUNT(DISTINCT o.owner_id) FROM (${OWNERSHIP_UNION}) AS o
     WHERE o.entity_type = ${table}.entity_type
       AND o.entity_id = ${table}.entity_id
   ) = 1`;
}

/** The two local resolution outcomes ADR-P030 actually offers (`MERGED` is not). */
const OFFERED_RESOLUTIONS = `'RESOLVED_LOCAL_WINS','RESOLVED_SERVER_WINS'`;

export const syncUserScopingMigration: Migration = {
  version: 6,
  name: 'sync-user-scoping',
  statements: [
    // ── sync_queue ───────────────────────────────────────────────────────────
    // Nullable + FK: NULL is the quarantine marker and is FK-exempt in SQLite.
    `ALTER TABLE sync_queue ADD COLUMN user_id TEXT REFERENCES local_user(id)`,
    backfillOwner('sync_queue'),
    `CREATE INDEX idx_sync_queue_user_status_retry
       ON sync_queue (user_id, status, next_retry_at)`,

    // ── sync_conflicts ───────────────────────────────────────────────────────
    `ALTER TABLE sync_conflicts ADD COLUMN user_id TEXT REFERENCES local_user(id)`,
    backfillOwner('sync_conflicts'),
    `CREATE INDEX idx_sync_conflicts_user_status ON sync_conflicts (user_id, status)`,

    // ── sync_conflicts: resolution outbox (ADR-P030 Decision 6) ──────────────
    // DORMANT SCHEMA ONLY. Slice C-4 owns T1 / T3 / T1′, `listUnsettledConflicts`,
    // retry and every transition; C-1 writes none of these columns. They live
    // here because a shipped migration is immutable.
    //
    // `chosen_resolution` — the user's decision, recorded the instant it is made
    // (T1); NULL until then. `MERGED` is declared in `status` but produced by
    // nothing and never offered, so it is excluded here.
    `ALTER TABLE sync_conflicts ADD COLUMN chosen_resolution TEXT
       CHECK (chosen_resolution IS NULL OR chosen_resolution IN (${OFFERED_RESOLUTIONS}))`,
    // When the choice was made (ISO-8601 UTC, the table's `created_at` convention).
    `ALTER TABLE sync_conflicts ADD COLUMN chosen_at TEXT`,
    // NULL before a choice exists, then the outbox lifecycle. `status` keeps its
    // own meaning — the authoritative state, moved only on server confirmation.
    `ALTER TABLE sync_conflicts ADD COLUMN settlement_status TEXT
       CHECK (settlement_status IS NULL
              OR settlement_status IN ('PENDING','IN_FLIGHT','FAILED','SETTLED'))`,
    // Retry bookkeeping, mirroring sync_queue.retry_count so the existing
    // `backoff.ts` policy applies unchanged.
    `ALTER TABLE sync_conflicts ADD COLUMN settlement_attempts INTEGER NOT NULL DEFAULT 0
       CHECK (settlement_attempts >= 0)`,
    `ALTER TABLE sync_conflicts ADD COLUMN next_attempt_at TEXT`,
    `ALTER TABLE sync_conflicts ADD COLUMN last_error TEXT`,
    // The last stable endpoint outcome code that blocked settlement (e.g.
    // RESTORE_UNSUPPORTED). A code keyed to localized copy — never a server string.
    `ALTER TABLE sync_conflicts ADD COLUMN last_failure_code TEXT`,
    // A choice the server has refused for this conflict, so the surface stops
    // offering it (T1′).
    `ALTER TABLE sync_conflicts ADD COLUMN blocked_resolution TEXT
       CHECK (blocked_resolution IS NULL OR blocked_resolution IN (${OFFERED_RESOLUTIONS}))`,

    // ── sync_state — primary key change requires a table rebuild ─────────────
    // SQLite cannot ALTER a primary key in place. Cursors are deliberately NOT
    // copied: they cannot be attributed to a user, so every (user, entity)
    // cursor starts at 0 and the next pull is a full re-pull.
    `CREATE TABLE sync_state_new (
      user_id         TEXT NOT NULL REFERENCES local_user(id),
      entity_type     TEXT NOT NULL,
      last_pulled_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_pulled_seq >= 0),
      last_pulled_at  TEXT,
      PRIMARY KEY (user_id, entity_type)
    )`,
    `DROP TABLE sync_state`,
    `ALTER TABLE sync_state_new RENAME TO sync_state`,
  ],
};
