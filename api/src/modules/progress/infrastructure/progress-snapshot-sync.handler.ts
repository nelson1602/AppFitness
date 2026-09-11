import { Injectable } from '@nestjs/common';

import {
  ApplyOutcome,
  EntitySyncHandler,
  OwnedRowSnapshot,
  PulledChange,
  ResolutionMutationInput,
  ServerEntityState,
  SyncOperationInput,
  SyncTx,
} from '../../sync/domain/sync.types';
import {
  parseProgressSnapshotCreate,
  parseProgressSnapshotUpdate,
} from '../domain/progress-payload';
import { ProgressRepositoryPort } from '../domain/progress.repository';
import { PROGRESS_SNAPSHOT_ENTITY_TYPE } from '../domain/progress.types';
import { progressSnapshotToWire } from './progress.mapper';

/**
 * `progress_snapshots` sync handler (ADR-P016 Slice 4b). Snapshots are computed
 * ON-DEVICE by the deterministic Slice 4a engine; this handler VALIDATES the
 * payload shape/ranges and persists it but NEVER recomputes (D2). Owner-scoped,
 * wellness data — no encryption, no audit, and no `redactForConflict` (numeric +
 * rule-version string only; no free text). Depends only on user ownership — no
 * `DEPENDENCY_NOT_READY`. The client-minted `id` is honored on CREATE. A
 * duplicate `(user_id, week_start, rule_version)` CREATE hits the DB unique
 * constraint and surfaces as an apply failure — never a silent overwrite (D6);
 * a rule-version bump writes a new tuple, so history is preserved. Feed-not-
 * override: storing a snapshot never touches TrainingPlan/nutrition/medical (D5).
 */
@Injectable()
export class ProgressSnapshotSyncHandler implements EntitySyncHandler {
  readonly entityType = PROGRESS_SNAPSHOT_ENTITY_TYPE;

  constructor(private readonly repo: ProgressRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedProgressSnapshot(
      tx,
      userId,
      entityId,
    );
    return record
      ? { version: record.version, snapshot: progressSnapshotToWire(record) }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE':
        affected = await this.repo.createProgressSnapshot(
          tx,
          userId,
          op.entityId,
          parseProgressSnapshotCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateProgressSnapshot(
          tx,
          userId,
          op.entityId,
          parseProgressSnapshotUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteProgressSnapshot(
          tx,
          userId,
          op.entityId,
          userId,
          op.baseVersion,
        );
        break;
    }
    return affected === 0 ? { status: 'STALE' } : { status: 'APPLIED' };
  }

  /** ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet. */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedProgressSnapshot(
      tx,
      userId,
      entityId,
    );
    return record
      ? {
          row: progressSnapshotToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

  /** ADR-P030 C-2 — conditional resolution mutation for C-3. Not called yet. */
  resolveConflictMutation(
    userId: string,
    entityId: string,
    input: ResolutionMutationInput,
    tx: SyncTx,
  ): Promise<number> {
    const common = {
      expectedVersion: input.expectedServerVersion,
      expectedDeleted: input.expectedDeleted,
      resolvedBy: userId,
    } as const;
    switch (input.operation) {
      case 'CREATE':
        return this.repo.resolveProgressSnapshot(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseProgressSnapshotCreate(input.payload),
        });
      case 'UPDATE':
        return this.repo.resolveProgressSnapshot(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseProgressSnapshotUpdate(input.payload),
        });
      case 'DELETE':
        return this.repo.resolveProgressSnapshot(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.repo.progressSnapshotsChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: progressSnapshotToWire(record),
    }));
  }
}
