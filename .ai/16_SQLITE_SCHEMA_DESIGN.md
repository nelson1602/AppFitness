# AppFitness Local SQLite Schema Design

Version: 1.0
Status: Active (Phase 4 baseline)
Last Updated: 2026-07-03

---

# Purpose

Design record for the mobile local Expo SQLite schema (ADR-0005,
migration Phase 4 of ADR-0013). The authoritative implementation is
`mobile/src/shared/infrastructure/database/migrations/001-initial.ts`;
this document records the mapping to PostgreSQL, the decisions, and the
deferred items the DDL cannot express.

The user-approved conceptual design was accepted 2026-07-03. Owner
decisions recorded at approval:

* **No local audit table** — audit entries are generated server-side
  when sync operations apply; local needs are covered by sync metadata
  (`sync_queue` payload timestamps preserve action time) and backend
  audit logs.
* **ADR-P001 remains Proposed** — the schema ships encryption-ready
  columns (`*_enc BLOB` + `enc_key_id`), and **no real sensitive data
  may be stored locally until ADR-P001 is Accepted** (Phase 8 gate).

---

# Structure

```
mobile/src/shared/infrastructure/database/
├── database.ts          # getDatabase(): open once, PRAGMAs (WAL, foreign_keys ON), migrate
├── migrations/
│   ├── index.ts         # ordered runner — PRAGMA user_version + migrations audit table
│   └── 001-initial.ts   # full DDL (27 tables) — never edited once shipped
├── sql.ts               # typed helpers: queryAll/queryFirst/run/inTransaction
├── types.ts             # row interfaces mirroring api/prisma models
└── index.ts             # barrel
```

Access rule (`.ai/06_MOBILE.md`): only feature `infrastructure/`
repositories import from this module. Screens/hooks/domain never touch
SQLite.

# PostgreSQL ↔ SQLite Mapping

Tables mirror `api/prisma/schema.prisma` 1:1 by name and column
(snake_case both sides), with these systematic differences:

| Aspect | PostgreSQL (server) | SQLite (device) |
|---|---|---|
| UUID / timestamptz / date | native types | TEXT (36-char / ISO-8601 UTC / YYYY-MM-DD) |
| boolean / enum / jsonb / bytea | native | INTEGER 0-1 + CHECK / TEXT + CHECK / TEXT json_valid() / BLOB |
| token list (`text[]`) | native array + `<@` allowed-token CHECK | TEXT holding a JSON array, `json_valid()` + `json_type() = 'array'` + bounded `json_array_length()` CHECK, plus named BEFORE INSERT/UPDATE triggers that walk `json_each` and reject any element that is not JSON text or is outside the allowed set (migration 007). A CHECK cannot do per-element work — it may not contain a subquery — so the vocabulary is enforced by trigger on the device and by array containment on the server |
| Sync cursor | `sync_seq` column per row | per-user, per-table cursor in `sync_state`, keyed `(user_id, entity_type)` (migration 006) |
| Sync status | (server is always authoritative) | `sync_status` per row: pending/synced/conflict |
| `"order"` column | `"order"` (quoted keyword) | `order_index` (avoids keyword quoting) — sync layer maps the name |

Same UUIDs on both sides — a row is the same row everywhere; sync is
state transfer, never ID mapping.

**Local-only tables (no server counterpart):** `sync_queue`,
`sync_state`, `sync_conflicts`, `app_metadata`, `migrations`,
`local_user` (minimal current-account row — **tokens live in
SecureStore, never SQLite**).

**Server-only tables (never local):** `devices`, `refresh_tokens`,
`sync_operations`, `sync_conflicts` (server variant), `audit_logs`.

**Catalog tables** (`exercises`, `foods`, `achievements`): pull-only,
no `user_id`, `sync_status` defaults to `'synced'`.

**Tables added after the baseline** (same 1:1 mapping rules): migration 003
`dietary_preferences`; migration 006 the ADR-P030 C-1 `user_id` scoping of
`sync_queue` / `sync_conflicts` / `sync_state` plus the dormant
resolution-outbox columns; migration 007 `wellness_safety_profiles` — the
ADR-P017 W-1 wellness-owned evaluation flag/date plus self-declared
limitation tokens. At most one live profile per user (a partial unique index
on `(user_id) WHERE deleted_at IS NULL`); a composite, user-scoped dirty-row
index `(user_id, sync_status) WHERE sync_status != 'synced'`; no free-text
column; and both token columns closed to their vocabularies by validation
triggers. Ownership is structurally represented and cascade-protected, which
is not access control: **W-2 must carry the authenticated `user_id`
predicate on every read, write, delete, dirty-row scan, push and pull** and
ship cross-user denial tests. W-1 is contract and storage only: no
repository, store, sync applier or registration exists for it yet.

# Key Decisions

* **CHECK constraints everywhere** — SQLite supports them natively, so
  the device DB currently enforces ranges (percentages, blood pressure,
  RPE 1–10, positive quantities) *more strictly* than the PG side will
  until its deferred raw-SQL migration lands. Both sides must converge
  on identical rules at PG migration time.
* **Partial indexes** — `WHERE deleted_at IS NULL` on hot list queries,
  plus per-table `WHERE sync_status != 'synced'` "dirty rows" indexes
  that the Phase 5 sync worker will scan cheaply.
* **FKs ON** per connection (`PRAGMA foreign_keys = ON`; off by default
  in SQLite). `user_id` references `local_user(id)`. Catalog
  `created_by` columns are deliberately *not* FKs (they can reference
  other users' IDs that don't exist locally).
* **Soft deletes only** for user data; tombstones sync as DELETE
  operations. Account switch/wipe = drop the database file and re-sync
  (v1 policy: one account per database).
* **`base_version` in `sync_queue`** — the server version an edit was
  based on; the server compares it to detect conflicts (mirrors
  `api` SyncOperation/SyncConflict design from Phase 3).
* **Migration runner** — `PRAGMA user_version` is the source of truth;
  a `migrations` table (version, name, applied_at) provides the audit
  trail. Each migration applies atomically in an exclusive transaction.
  Shipped migrations are never edited (`.ai/04_DATABASE.md`).

# Deferred / Blocked Items

* **Field encryption implementation** — blocked on ADR-P001 acceptance
  + crypto library approval. Columns are ready; `field-cipher.ts` is
  planned for `mobile/src/shared/infrastructure/crypto/` in Phase 8.
* **Runtime execution on device** — the module compiles and passes all
  static validation, but `getDatabase()` has no caller yet (first
  repositories arrive with Phase 5/6 features). Actual on-device
  migration execution is validated then, plus by the pending human
  simulator run.
* **`health_logs.notes` encryption question** — open in both ADR-P001
  and ADR-P006; resolve before Phase 8.

# AI Instructions

* `001-initial.ts` is shipped DDL — never edit it; add new migrations.
* Keep this schema and `api/prisma/schema.prisma` in lockstep: any
  server schema change needs a paired local migration and vice versa.
* Never store real medical free-text locally until ADR-P001 is Accepted.
* Repositories only via `sql.ts` helpers; no SQL outside
  `infrastructure/` layers.
