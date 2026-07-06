import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import {
  parseEvaluationPayload,
  parseRestrictionPayload,
  requireEvaluationDate,
  requireRestrictionType,
} from '../domain/medical-payload';
import {
  EvaluationRepositoryPort,
  RestrictionRepositoryPort,
} from '../domain/medical.repository';
import {
  EVALUATION_ENTITY_TYPE,
  RESTRICTION_ENTITY_TYPE,
} from '../domain/medical.types';
import {
  evaluationToWire,
  redactEvaluation,
  redactRestriction,
  restrictionToWire,
} from './medical.mapper';

/**
 * Evaluations are APPEND-ONLY: UPDATE operations are rejected — medical
 * history is never modified in place (.ai/04_DATABASE.md,
 * .ai/07_ICOACH.md). Corrections = new evaluation + soft delete.
 */
@Injectable()
export class EvaluationSyncHandler implements EntitySyncHandler {
  readonly entityType = EVALUATION_ENTITY_TYPE;

  constructor(
    private readonly evaluations: EvaluationRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.evaluations.findOwned(userId, entityId);
    // Snapshot is redacted at the source — this value is only ever used
    // for conflict persistence, never for pulls.
    return record
      ? {
          version: record.version,
          snapshot: redactEvaluation(evaluationToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const attributes = parseEvaluationPayload(op.payload);
        requireEvaluationDate(attributes);
        await this.evaluations.create(userId, attributes, op.entityId);
        await this.audit.record({
          action: AuditAction.MEDICAL_EVALUATION_CREATE,
          userId,
          entityType: this.entityType,
          entityId: op.entityId,
          metadata: { via: 'sync' },
        });
        break;
      }
      case 'UPDATE': {
        throw new Error(
          'medical evaluations are immutable — create a new evaluation instead',
        );
      }
      case 'DELETE': {
        await this.evaluations.softDelete(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        await this.audit.record({
          action: AuditAction.MEDICAL_EVALUATION_DELETE,
          userId,
          entityType: this.entityType,
          entityId: op.entityId,
          metadata: { via: 'sync' },
        });
        break;
      }
    }
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.evaluations.changedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: evaluationToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactEvaluation(payload);
  }
}

@Injectable()
export class RestrictionSyncHandler implements EntitySyncHandler {
  readonly entityType = RESTRICTION_ENTITY_TYPE;

  constructor(
    private readonly restrictions: RestrictionRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.restrictions.findOwned(userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: redactRestriction(restrictionToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const attributes = parseRestrictionPayload(op.payload);
        requireRestrictionType(attributes);
        await this.restrictions.create(userId, attributes, op.entityId);
        break;
      }
      case 'UPDATE': {
        await this.restrictions.update(
          op.entityId,
          parseRestrictionPayload(op.payload),
          op.baseVersion + 1,
        );
        break;
      }
      case 'DELETE': {
        await this.restrictions.softDelete(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        break;
      }
    }
    await this.audit.record({
      action: AuditAction.MEDICAL_RESTRICTION_CHANGE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
  }

  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.restrictions.changedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: restrictionToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactRestriction(payload);
  }
}
