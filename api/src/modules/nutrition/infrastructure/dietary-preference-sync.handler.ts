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
  ): Promise<ServerEntityState | null> {
    const record = await this.preferences.findOwned(userId, entityId);
    return record
      ? {
          version: record.version,
          // Redacted at source — only ever persisted into sync_conflicts.
          snapshot: redactDietaryPreference(dietaryPreferenceToWire(record)),
        }
      : null;
  }

  async apply(userId: string, op: SyncOperationInput): Promise<void> {
    switch (op.operation) {
      case 'CREATE': {
        const attributes = parseDietaryPreferenceCreate(op.payload);
        await this.preferences.create(userId, op.entityId, attributes);
        break;
      }
      case 'UPDATE': {
        // Ownership + version enforced by the pipeline via getServerState.
        // Only kind + note are mutable; the exclusion target is immutable.
        const update = parseDietaryPreferenceUpdate(op.payload);
        await this.preferences.update(op.entityId, update, op.baseVersion + 1);
        break;
      }
      case 'DELETE': {
        await this.preferences.softDelete(
          op.entityId,
          userId,
          op.baseVersion + 1,
        );
        break;
      }
    }

    // Operational metadata only — never the note or exclusion details.
    await this.audit.record({
      action: AuditAction.NUTRITION_CHANGE,
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
}
