import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
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
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedProgressSnapshot(userId, entityId);
    return record
      ? { version: record.version, snapshot: progressSnapshotToWire(record) }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE':
        await this.repo.createProgressSnapshot(
          userId,
          op.entityId,
          parseProgressSnapshotCreate(op.payload),
        );
        break;
      case 'UPDATE':
        await this.repo.updateProgressSnapshot(
          op.entityId,
          parseProgressSnapshotUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteProgressSnapshot(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        break;
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
