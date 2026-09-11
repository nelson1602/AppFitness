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
  parseBodyWeightCreate,
  parseBodyWeightUpdate,
} from '../domain/progress-payload';
import { ProgressRepositoryPort } from '../domain/progress.repository';
import { BODY_WEIGHT_ENTITY_TYPE } from '../domain/progress.types';
import { bodyWeightToWire, redactProgressNotes } from './progress.mapper';

/**
 * `body_weights` sync handler (ADR-P016 Slice 3a). Owner-scoped, wellness data
 * (no encryption, no audit). Depends only on user ownership — no parent, so no
 * `DEPENDENCY_NOT_READY`. A duplicate `(user_id, date)` CREATE hits the DB
 * unique constraint and surfaces as an apply failure — never a silent overwrite
 * (ADR-P016 D6). Free-text `notes` is redacted before a conflict snapshot is
 * persisted.
 *
 * ADR-P030 C-2: every read and write runs on the operation's transaction, and
 * the version is re-asserted **in the write predicate** rather than only by the
 * pipeline's earlier `getServerState` check.
 */
@Injectable()
export class BodyWeightSyncHandler implements EntitySyncHandler {
  readonly entityType = BODY_WEIGHT_ENTITY_TYPE;

  constructor(private readonly repo: ProgressRepositoryPort) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedBodyWeight(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactProgressNotes(bodyWeightToWire(record)),
        }
      : null;
  }

  /**
   * ADR-P030 C-2: each mutation carries owner + expected version + the active
   * tombstone state and reports its affected-row count. `0` is a late race —
   * the row moved between the pipeline's early check and this write, or the
   * insert hit an id that now exists — which the pipeline turns into an
   * ordinary conflict. Reporting it never throws, so the transaction stays
   * usable for the re-read and the conflict row.
   */
  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE':
        affected = await this.repo.createBodyWeight(
          tx,
          userId,
          op.entityId,
          parseBodyWeightCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateBodyWeight(
          tx,
          userId,
          op.entityId,
          parseBodyWeightUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteBodyWeight(
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

  /**
   * ADR-P030 C-2 — the owner-scoped **unredacted** current row, in the wire
   * shape `pullChanges` already produces. Added for the resolution slice (C-3);
   * **no endpoint consumes it yet**.
   */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.repo.findOwnedBodyWeight(tx, userId, entityId);
    return record
      ? {
          row: bodyWeightToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

  /**
   * ADR-P030 C-2 — one conditional resolution mutation. `apply()` is not reused:
   * a retained `CREATE` would collide on the primary key, and a partial
   * `UPDATE` treated as a replacement would erase omitted fields (A-15(c)/(d)).
   * Added for C-3; **no endpoint calls it yet**.
   */
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
        return this.repo.resolveBodyWeight(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseBodyWeightCreate(input.payload),
          ),
        });
      case 'UPDATE':
        return this.repo.resolveBodyWeight(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseBodyWeightUpdate(input.payload),
          ),
        });
      case 'DELETE':
        return this.repo.resolveBodyWeight(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
