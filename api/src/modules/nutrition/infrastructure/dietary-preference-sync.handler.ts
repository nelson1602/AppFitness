import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
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
  parseDietaryPreferenceCreate,
  parseDietaryPreferenceUpdate,
} from '../domain/dietary-preference-payload';
import { DietaryPreferenceRepositoryPort } from '../domain/dietary-preference.repository';
import { DIETARY_PREFERENCE_ENTITY_TYPE } from '../domain/dietary-preference.types';
import {
  dietaryPreferenceToWire,
  redactDietaryPreference,
} from './dietary-preference.mapper';

/**
 * dietary_preferences sync handler (ADR-P014 Slice 2A). Foundation only — no
 * REST write endpoint. Safety rules:
 *
 * - All reads/writes are scoped to the authenticated `user_id` (never payload).
 * - CREATE validates the exclusion contract (exactly one target matching type);
 *   the exclusion target is immutable, so UPDATE mutates only kind + note.
 * - The optional `note` is AES-256-GCM encrypted at rest (repository, ADR-P006)
 *   and REDACTED from conflict snapshots — never persisted plaintext in JSONB.
 * - Version conflicts are handled by the pipeline (recorded, never overwritten).
 * - DELETE is a soft-delete tombstone.
 *
 * ADR-P030 C-2: every read and write runs on the push operation's transaction
 * client, the write predicate itself carries owner + expected version + the
 * reviewed tombstone state, and a zero-row write returns `STALE` instead of
 * reporting success. The audit record deliberately stays on the audit service's
 * own client: it is best-effort and must not be undone by a rollback of the
 * entity mutation (§Decision 11).
 */
@Injectable()
export class DietaryPreferenceSyncHandler implements EntitySyncHandler {
  readonly entityType = DIETARY_PREFERENCE_ENTITY_TYPE;

  constructor(
    private readonly preferences: DietaryPreferenceRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.preferences.findOwned(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          // Redacted at source — only ever persisted into sync_conflicts.
          snapshot: redactDietaryPreference(dietaryPreferenceToWire(record)),
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
      case 'CREATE': {
        const attributes = parseDietaryPreferenceCreate(op.payload);
        affected = await this.preferences.create(
          tx,
          userId,
          op.entityId,
          attributes,
        );
        break;
      }
      case 'UPDATE': {
        // Only kind + note are mutable; the exclusion target is immutable.
        const update = parseDietaryPreferenceUpdate(op.payload);
        affected = await this.preferences.update(
          tx,
          userId,
          op.entityId,
          update,
          op.baseVersion,
        );
        break;
      }
      case 'DELETE': {
        affected = await this.preferences.softDelete(
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

    // Operational metadata only — never the note or exclusion details.
    await this.audit.record({
      action: AuditAction.NUTRITION_CHANGE,
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
    const records = await this.preferences.changedSince(
      userId,
      sinceSeq,
      limit,
    );
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: dietaryPreferenceToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    return redactDietaryPreference(payload);
  }

  /**
   * ADR-P030 C-2 — unredacted owner row for C-3. No endpoint consumes it yet.
   * Unlike `getServerState`, the note is NOT redacted here: this value is
   * returned to the owner over TLS and is never written to sync_conflicts.
   */
  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    const record = await this.preferences.findOwned(tx, userId, entityId);
    return record
      ? {
          row: dietaryPreferenceToWire(record),
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
        return this.preferences.resolve(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          attributes: parseDietaryPreferenceCreate(input.payload),
        });
      case 'UPDATE':
        return this.preferences.resolve(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          update: parseDietaryPreferenceUpdate(input.payload),
        });
      case 'DELETE':
        return this.preferences.resolve(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
