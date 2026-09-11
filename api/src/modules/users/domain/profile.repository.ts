import type { SyncTx } from '../../sync/domain/sync.types';
import { ProfileAttributes, ProfileRecord } from './profile.types';

/**
 * One conflict resolution for `user_profiles`, per ADR-P030 §Decision 3.
 * Same shape as the other entities: the reviewed tombstone state selects the
 * predicate, and an `UPDATE` patch leaves omitted keys untouched.
 */
export type ProfileResolution = {
  expectedVersion: number;
  expectedDeleted: boolean;
  resolvedBy: string;
} & (
  | { operation: 'CREATE'; attributes: Partial<ProfileAttributes> }
  | { operation: 'UPDATE'; attributes: Partial<ProfileAttributes> }
  | { operation: 'DELETE' }
);

/**
 * Repository port (Dependency Inversion): the domain/application layers
 * depend on this abstraction; infrastructure provides the Prisma
 * implementation. Also serves as the Nest injection token.
 *
 * ── ADR-P030 C-2 ───────────────────────────────────────────────────────────
 * `user_profiles` has a **REST caller** (`ProfileService.upsertMyProfile`), so
 * the existing `findByUserId` / `create` / `update` / `softDelete` keep their
 * current semantics untouched and the sync path gets its own
 * `…ForSync` operations. Only those take the operation's transaction client,
 * carry owner + expected version + the reviewed tombstone state in the write
 * predicate, and return an affected-row count.
 */
export abstract class ProfileRepositoryPort {
  // ── REST path — unchanged by C-2 ──────────────────────────────────────────
  abstract findByUserId(userId: string): Promise<ProfileRecord | null>;
  /** Ownership-scoped lookup — returns null for other users' rows. */
  abstract findOwned(userId: string, id: string): Promise<ProfileRecord | null>;
  abstract create(
    userId: string,
    attributes: Partial<ProfileAttributes>,
    id?: string,
  ): Promise<ProfileRecord>;
  /** Writes attributes and sets the row to `newVersion`. */
  abstract update(
    id: string,
    attributes: Partial<ProfileAttributes>,
    newVersion: number,
  ): Promise<ProfileRecord>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  /** Rows (incl. tombstones) with sync_seq > sinceSeq, ascending, limited. */
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProfileRecord[]>;

  // ── Sync path — ADR-P030 C-2 ──────────────────────────────────────────────
  abstract findOwnedForSync(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<ProfileRecord | null>;
  /** @returns 1 inserted, 0 when the id already exists (primary key only). */
  abstract createForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: ProfileAttributes,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract updateForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: Partial<ProfileAttributes>,
    expectedVersion: number,
  ): Promise<number>;
  /** @returns affected rows: 1 applied, 0 stale. */
  abstract softDeleteForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number>;
  /** ADR-P030 C-2 resolution mutation. No endpoint calls it yet. */
  abstract resolveForSync(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: ProfileResolution,
  ): Promise<number>;
}
