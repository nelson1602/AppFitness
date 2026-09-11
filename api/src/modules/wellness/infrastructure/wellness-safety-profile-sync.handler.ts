import { Inject, Injectable } from '@nestjs/common';

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
import { parseWellnessSafetyProfileWrite } from '../domain/wellness-payload';
import { WellnessRepositoryPort } from '../domain/wellness.repository';
import {
  WELLNESS_CLOCK,
  WELLNESS_SAFETY_PROFILE_ENTITY_TYPE,
  type WellnessClock,
} from '../domain/wellness.types';
import { wellnessToWire } from './wellness.mapper';

/**
 * `wellness_safety_profiles` sync handler (ADR-P017 **W-2**).
 *
 * The existing sync endpoints are the only transport: this module adds no REST
 * controller and no new route. Ownership comes exclusively from the
 * authenticated `userId` the pipeline passes in — a client-supplied `user_id`
 * in the payload is never read, so it cannot change who owns a row.
 *
 * The aggregate is a per-user singleton whose id IS the owner's UUID, so
 * `entityId === userId` is required. That is what makes two devices creating it
 * offline converge: both mint the same identity, the first CREATE applies, and
 * the second meets the pipeline's existing `CREATE` + existing-state rule and
 * comes back as CONFLICT with the server snapshot — never a duplicate-key
 * failure and never a silent overwrite. `getServerState` therefore includes a
 * tombstoned row: hiding it would turn the device's revive UPDATE into a
 * spurious NOT_FOUND, and re-entering a profile after a delete travels as an
 * UPDATE precisely because the id is fixed.
 *
 * Wellness data: no field encryption and no audit entry. The token arrays are
 * user-declared content, so they are never logged and no error message echoes
 * them.
 */
@Injectable()
export class WellnessSafetyProfileSyncHandler implements EntitySyncHandler {
  readonly entityType = WELLNESS_SAFETY_PROFILE_ENTITY_TYPE;

  constructor(
    private readonly repo: WellnessRepositoryPort,
    @Inject(WELLNESS_CLOCK) private readonly clock: WellnessClock,
  ) {}

  /**
   * Server state for conflict detection — owner-scoped, so another account's
   * row is simply invisible rather than "found but rejected".
   */
  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    if (entityId !== userId) return null;
    const record = await this.repo.findOwned(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: wellnessToWire(record) }
      : null;
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    if (op.entityId !== userId) {
      // The singleton id is the owner. A mismatch is either a tampered client
      // or an attempt to write someone else's row; both fail closed.
      throw new Error(
        'wellness_safety_profiles: entityId must equal the authenticated user id',
      );
    }

    // ONE reading per operation: the date bound and any tombstone then agree
    // with each other, and both are whatever the injected clock said.
    const now = this.clock.now();

    let affected: number;
    switch (op.operation) {
      case 'CREATE': {
        const data = parseWellnessSafetyProfileWrite(op.payload, now);
        affected = await this.repo.create(tx, userId, userId, data);
        break;
      }
      case 'UPDATE': {
        // Also the revive path: re-entering a profile after a delete is an
        // UPDATE of the same singleton row (the device enqueues exactly that),
        // and `update` clears the tombstone.
        const data = parseWellnessSafetyProfileWrite(op.payload, now);
        affected = await this.repo.update(
          tx,
          userId,
          userId,
          data,
          op.baseVersion,
        );
        break;
      }
      case 'DELETE': {
        affected = await this.repo.softDelete(
          tx,
          userId,
          userId,
          op.baseVersion,
          now,
        );
        break;
      }
    }
    return affected === 0 ? { status: 'STALE' } : { status: 'APPLIED' };
  }

  /** Incremental pull, owner-scoped, tombstones included. */
  async pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]> {
    const records = await this.repo.changedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: wellnessToWire(record),
    }));
  }

  async readCurrentOwnedRow(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null> {
    if (entityId !== userId) return null;
    const record = await this.repo.findOwned(tx, userId, entityId);
    return record
      ? {
          row: wellnessToWire(record),
          version: record.version,
          deleted: record.deletedAt !== null,
        }
      : null;
  }

  resolveConflictMutation(
    userId: string,
    entityId: string,
    input: ResolutionMutationInput,
    tx: SyncTx,
  ): Promise<number> {
    if (entityId !== userId) return Promise.resolve(0);
    const common = {
      expectedVersion: input.expectedServerVersion,
      expectedDeleted: input.expectedDeleted,
      resolvedBy: userId,
    } as const;
    const now = this.clock.now();
    switch (input.operation) {
      case 'CREATE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'CREATE',
          data: parseConflictPayload(() =>
            parseWellnessSafetyProfileWrite(input.payload, now),
          ),
        });
      case 'UPDATE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'UPDATE',
          data: parseConflictPayload(() =>
            parseWellnessSafetyProfileWrite(input.payload, now),
          ),
        });
      case 'DELETE':
        return this.repo.resolve(tx, userId, entityId, {
          ...common,
          operation: 'DELETE',
        });
    }
  }
}
