import type { SyncTx } from '../../sync/domain/sync.types';
import type {
  BodyMeasurementCreateInput,
  BodyMeasurementUpdateInput,
  BodyWeightCreateInput,
  BodyWeightUpdateInput,
  ProgressSnapshotCreateInput,
  ProgressSnapshotUpdateInput,
} from './progress-payload';
import type {
  BodyMeasurementRecord,
  BodyWeightRecord,
  ProgressSnapshotRecord,
} from './progress.types';

/**
 * The per-operation resolution semantics of ADR-P030 §Decision 3, expressed
 * once for this module.
 *
 * `apply()` is deliberately not reused: a retained `CREATE` would fail on the
 * primary key, and a partial `UPDATE` treated as a full representation would
 * erase the fields it omits (A-15(c)/(d)).
 *
 * - `CREATE` carries the **complete** create-parsed representation, because the
 *   row already exists and the create parser is total.
 * - `UPDATE` carries the entity's own update-parsed payload, preserving its
 *   partial-vs-total semantics exactly.
 * - `DELETE` carries nothing; the retained payload is empty by design.
 *
 * `expectedDeleted` is the tombstone state the user reviewed. It selects the
 * predicate — an active row is matched with `deleted_at IS NULL`, a reviewed
 * tombstone with `deleted_at IS NOT NULL` and restored — so the server never
 * has to infer which it is.
 */
export type ProgressResolution<TCreate, TUpdate> = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; data: TCreate }
  | { operation: 'UPDATE'; data: TUpdate }
  | { operation: 'DELETE' }
);

/**
 * Repository port for the Progress Monitoring write entities (ADR-P016 Slice
 * 3a). One port for the module; the implementation owns persistence only, while
 * handlers own validation/ownership. These entities depend only on user
 * ownership (no parent entity), so there is no dependency probe.
 *
 * ── ADR-P030 slice C-2 ─────────────────────────────────────────────────────
 * Every sync-path method takes the operation's transaction client explicitly
 * and **never** falls back to the root client, so an entity mutation commits
 * with — or rolls back with — the `SyncOperation` row that records it.
 *
 * Ownership and version are no longer established only by an earlier
 * `findOwned*` read: every existing-row mutation carries
 * `id + user_id + version` plus the reviewed tombstone state **in the write
 * itself** and returns the **affected-row count**. `0` is a late race — the row
 * moved between the check and the write — and the caller reports it as a normal
 * conflict instead of overwriting silently (A-15(a)/(b)).
 *
 * `create*` stays an insert and gains no predicate: it returns `1` when the row
 * was inserted and `0` when the client-minted id already exists. Every other
 * constraint — `body_weights`' `UNIQUE(user_id, date)`, for instance — still
 * throws, because an insertion race is not a business-rule violation.
 */
export abstract class ProgressRepositoryPort {
  // ── body_weights ──────────────────────────────────────────────────────────
  abstract findOwnedBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<BodyWeightRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract createBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyWeightCreateInput,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract updateBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyWeightUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDeleteBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract bodyWeightsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyWeightRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolveBodyWeight(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      BodyWeightCreateInput,
      BodyWeightUpdateInput
    >,
  ): Promise<number>;

  // ── body_measurements ───────────────────────────────────────────────────────
  abstract findOwnedBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<BodyMeasurementRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract createBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyMeasurementCreateInput,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract updateBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    data: BodyMeasurementUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDeleteBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract bodyMeasurementsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyMeasurementRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolveBodyMeasurement(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      BodyMeasurementCreateInput,
      BodyMeasurementUpdateInput
    >,
  ): Promise<number>;

  // ── progress_snapshots (Slice 4b) ─────────────────────────────────────────
  // Client-computed rollups (Slice 4a); the id is client-minted and honored.
  abstract findOwnedProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<ProgressSnapshotRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract createProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ProgressSnapshotCreateInput,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract updateProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    data: ProgressSnapshotUpdateInput,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDeleteProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  abstract progressSnapshotsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProgressSnapshotRecord[]>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolveProgressSnapshot(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProgressResolution<
      ProgressSnapshotCreateInput,
      ProgressSnapshotUpdateInput
    >,
  ): Promise<number>;
}
