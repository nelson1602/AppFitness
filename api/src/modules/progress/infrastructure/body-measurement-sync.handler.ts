import { Injectable } from '@nestjs/common';

import {
  ApplyOutcome,
  EntitySyncHandler,
  OwnedRowSnapshot,
  parseConflictPayload,
  PulledChange,
  ResolutionMutationInput,
  ServerEntityState,
  SyncOperationInput,
  SyncTx,
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
 * user-only dependency, duplicate `(user_id, date)` CREATE surfaces as an apply
 * failure (D6), and free-text `notes` is redacted before a conflict snapshot is
 * persisted.
 *
 * ADR-P030 C-2: transaction-aware, with owner + expected version carried in the
 * write predicate and a typed outcome.
 */
@Injectable()
export class BodyMeasurementSyncHandler implements EntitySyncHandler {
  readonly entityType = BODY_MEASUREMENT_ENTITY_TYPE;

  constructor(private readonly repo: ProgressRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedBodyMeasurement(
      tx,
      userId,
      entityId,
    );
    return record
      ? {
          version: record.version,
          snapshot: redactProgressNotes(bodyMeasurementToWire(record)),
        }
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
        affected = await this.repo.createBodyMeasurement(
          tx,
          userId,
          op.entityId,
          parseBodyMeasurementCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateBodyMeasurement(
          tx,
          userId,
          op.entityId,
          parseBodyMeasurementUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteBodyMeasurement(
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

  /** ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet. */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedBodyMeasurement(
      tx,
      userId,
      entityId,
    );
    return record
      ? {
          row: bodyMeasurementToWire(record),
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
        return this.repo.resolveBodyMeasurement(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseBodyMeasurementCreate(input.payload),
          ),
        });
      case 'UPDATE':
        return this.repo.resolveBodyMeasurement(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseBodyMeasurementUpdate(input.payload),
          ),
        });
      case 'DELETE':
        return this.repo.resolveBodyMeasurement(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
