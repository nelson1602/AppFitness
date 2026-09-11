import type { SyncTx } from '../../sync/domain/sync.types';
import type { WellnessSafetyProfileWriteInput } from './wellness-payload';
import type { WellnessSafetyProfileRecord } from './wellness.types';

/**
 * Repository port for the Wellness Safety Profile (ADR-P017 W-2).
 *
 * **Every method takes `userId` and every statement must use it.** The older
 * progress repository updates and soft-deletes by id alone, which leaves
 * ownership enforcement to the caller; this port makes that impossible by
 * construction — there is no method that can address a row without its owner.
 * Mutating methods report how many rows they changed so the handler can turn a
 * zero-row write (wrong owner, or a row that vanished) into an explicit
 * failure instead of a silent no-op.
 */
export abstract class WellnessRepositoryPort {
  abstract findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WellnessSafetyProfileRecord | null>;

  abstract create(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
  ): Promise<number>;

  /**
   * Write the contract fields and the new version, clearing any tombstone.
   *
   * This is also the **revive** path: the aggregate is a per-user singleton
   * whose id is fixed, so re-entering a profile after a delete is an UPDATE of
   * the same row (the device enqueues exactly that), not a second INSERT that
   * the partial unique index would reject. Conflict detection has already
   * compared the client's `baseVersion` against the tombstone's version, so an
   * UPDATE reaching here is a client that knew the row was deleted.
   *
   * Returns the number of rows updated: 1 on success, 0 if not owned.
   */
  abstract update(
    tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
    expectedVersion: number,
  ): Promise<number>;

  /**
   * Tombstone the row at exactly `deletedAt`.
   *
   * The instant is supplied, never read here: the handler takes one reading
   * from the injected clock and passes it down, so a delete is deterministic
   * and testable and the persistence layer holds no time source of its own.
   *
   * Returns the number of rows updated: 1 on success, 0 if not owned/live.
   */
  abstract softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
    deletedAt: Date,
  ): Promise<number>;

  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WellnessSafetyProfileRecord[]>;

  abstract resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: WellnessResolution,
  ): Promise<number>;
}

export type WellnessResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; data: WellnessSafetyProfileWriteInput }
  | { operation: 'UPDATE'; data: WellnessSafetyProfileWriteInput }
  | { operation: 'DELETE' }
);
