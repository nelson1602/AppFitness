import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
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
  parseCompleteProfilePayload,
  parseProfilePayload,
} from '../domain/profile-payload';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import { PROFILE_DEFAULTS, PROFILE_ENTITY_TYPE } from '../domain/profile.types';
import { toWire } from './profile.mapper';

/**
 * First real EntitySyncHandler (Phase 7). The sync pipeline has already
 * verified idempotency and ownership (via getServerState's user scoping) before
 * apply() runs. This handler owns payload validation and the actual writes.
 *
 * Profile conflict policy: version mismatches stay manual (pipeline
 * default). Field-level last-writer-wins was considered and deliberately
 * NOT applied to profile: training targets/goal inputs feed iCoach, so a
 * silent merge could produce recommendations neither device requested.
 *
 * ADR-P030 C-2: the sync path uses the port's `…ForSync` operations, which take
 * the operation's transaction and re-assert owner + expected version + the
 * reviewed tombstone state **in the write**. `ProfileService.upsertMyProfile`
 * keeps using the untouched REST methods.
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
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.profiles.findOwnedForSync(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: toWire(record) }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE': {
        // Defaults are merged here, so the repository receives a complete
        // representation and its static insert needs no re-derived defaults.
        const attributes = {
          ...PROFILE_DEFAULTS,
          ...parseProfilePayload(op.payload),
        };
        // userId comes from the JWT, never from the payload.
        affected = await this.profiles.createForSync(
          tx,
          userId,
          op.entityId,
          attributes,
        );
        break;
      }
      case 'UPDATE': {
        affected = await this.profiles.updateForSync(
          tx,
          userId,
          op.entityId,
          parseProfilePayload(op.payload),
          op.baseVersion,
        );
        break;
      }
      case 'DELETE': {
        affected = await this.profiles.softDeleteForSync(
          tx,
          userId,
          op.entityId,
          userId,
          op.baseVersion,
        );
        break;
      }
    }

    // A late race wrote nothing, so there is nothing to audit as a change.
    if (affected === 0) return { status: 'STALE' };

    await this.audit.record({
      action: AuditAction.PROFILE_UPDATE,
      userId,
      entityType: this.entityType,
      entityId: op.entityId,
      metadata: { via: 'sync', operation: op.operation },
    });
    return { status: 'APPLIED' };
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

  /** ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet. */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.profiles.findOwnedForSync(tx, userId, entityId);
    return record
      ? {
          row: toWire(record),
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
        return this.profiles.resolveForSync(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          attributes: parseConflictPayload(() =>
            parseCompleteProfilePayload(input.payload),
          ),
        });
      case 'UPDATE':
        return this.profiles.resolveForSync(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          attributes: parseConflictPayload(() =>
            parseProfilePayload(input.payload),
          ),
        });
      case 'DELETE':
        return this.profiles.resolveForSync(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
