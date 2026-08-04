import { Injectable } from '@nestjs/common';

import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseBodyMeasurementCreate,
  parseBodyMeasurementUpdate,
} from '../domain/progress-payload';
import { ProgressRepositoryPort } from '../domain/progress.repository';
import { BODY_MEASUREMENT_ENTITY_TYPE } from '../domain/progress.types';
import { bodyMeasurementToWire, redactProgressNotes } from './progress.mapper';

/**
 * `body_measurements` sync handler (ADR-P016 Slice 3a). Same contract and safety
 * rules as `body_weights`: owner-scoped, wellness (no encryption/audit),
 * user-only dependency, pipeline-enforced version conflicts, duplicate
 * `(user_id, date)` CREATE surfaces as an apply failure (D6), and free-text
 * `notes` is redacted before a conflict snapshot is persisted.
 */
@Injectable()
export class BodyMeasurementSyncHandler implements EntitySyncHandler {
  readonly entityType = BODY_MEASUREMENT_ENTITY_TYPE;

  constructor(private readonly repo: ProgressRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedBodyMeasurement(userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactProgressNotes(bodyMeasurementToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE':
        await this.repo.createBodyMeasurement(
          userId,
          op.entityId,
          parseBodyMeasurementCreate(op.payload),
        );
        break;
      case 'UPDATE':
        await this.repo.updateBodyMeasurement(
          op.entityId,
          parseBodyMeasurementUpdate(op.payload),
          op.baseVersion + 1,
        );
        break;
      case 'DELETE':
        await this.repo.softDeleteBodyMeasurement(
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
    const records = await this.repo.bodyMeasurementsChangedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: bodyMeasurementToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactProgressNotes(payload);
  }
}
