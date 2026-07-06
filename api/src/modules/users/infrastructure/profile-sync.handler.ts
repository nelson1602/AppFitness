import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SyncOperationInput,
} from '../../sync/domain/sync.types';
import { parseProfilePayload } from '../domain/profile-payload';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import { PROFILE_DEFAULTS, PROFILE_ENTITY_TYPE } from '../domain/profile.types';
import { toWire } from './profile.mapper';

/**
 * First real EntitySyncHandler (Phase 7). The sync pipeline has already
 * verified idempotency, ownership (via getServerState's user scoping),
 * and baseVersion match before apply() runs. This handler owns payload
 * validation and the actual writes.
 *
 * Profile conflict policy: version mismatches stay manual (pipeline
 * default). Field-level last-writer-wins was considered and deliberately
 * NOT applied to profile: training targets/goal inputs feed iCoach, so a
 * silent merge could produce recommendations neither device requested.
 */
@Injectable()
export class ProfileSyncHandler implements EntitySyncHandler {
  readonly entityType = PROFILE_ENTITY_TYPE;

  constructor(
    private readonly profiles: ProfileRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null> {
    const record = await this.profiles.findOwned(userId, entityId);
    return record
      ? { version: record.version, snapshot: toWire(record) }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const attributes = {
          ...PROFILE_DEFAULTS,
          ...parseProfilePayload(op.payload),
        };
        // userId comes from the JWT, never from the payload.
        await this.profiles.create(userId, attributes, op.entityId);
        break;
      }
      case 'UPDATE': {
        const attributes = parseProfilePayload(op.payload);
        await this.profiles.update(op.entityId, attributes, op.baseVersion + 1);
        break;
      }
      case 'DELETE': {
        await this.profiles.softDelete(op.entityId, userId, op.baseVersion + 1);
        break;
      }
    }
    await this.audit.record({
      action: AuditAction.PROFILE_UPDATE,
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
    const records = await this.profiles.changedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: toWire(record),
    }));
  }
}
