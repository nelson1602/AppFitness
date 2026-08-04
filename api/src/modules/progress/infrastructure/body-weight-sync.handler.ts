import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseBodyWeightCreate,
  parseBodyWeightUpdate,
} from '../domain/progress-payload';
import { ProgressRepositoryPort } from '../domain/progress.repository';
import { BODY_WEIGHT_ENTITY_TYPE } from '../domain/progress.types';
import { bodyWeightToWire, redactProgressNotes } from './progress.mapper';

/**
 * `body_weights` sync handler (ADR-P016 Slice 3a). Owner-scoped, wellness data
 * (no encryption, no audit). Depends only on user ownership — no parent, so no
 * `DEPENDENCY_NOT_READY`. Version conflicts are enforced by the pipeline via
 * `getServerState` + baseVersion. A duplicate `(user_id, date)` CREATE hits the
 * DB unique constraint and surfaces as an apply failure — never a silent
 * overwrite (ADR-P016 D6). Free-text `notes` is redacted before a conflict
 * snapshot is persisted.
 */
@Injectable()
export class BodyWeightSyncHandler implements EntitySyncHandler {
  readonly entityType = BODY_WEIGHT_ENTITY_TYPE;

  constructor(private readonly repo: ProgressRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedBodyWeight(userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactProgressNotes(bodyWeightToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE':
        await this.repo.createBodyWeight(
          userId,
          op.entityId,
          parseBodyWeightCreate(op.payload),
        );
        break;
      case 'UPDATE':
        await this.repo.updateBodyWeight(
          op.entityId,
          parseBodyWeightUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteBodyWeight(
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
    const records = await this.repo.bodyWeightsChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: bodyWeightToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactProgressNotes(payload);
  }
}
