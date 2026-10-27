import { Injectable } from '@nestjs/common';

import {
  ApplyOutcome,
  EntitySyncHandler,
  PulledChange,
  ServerEntityState,
  SYNC_ERROR_CODES,
  SyncApplyError,
  SyncOperationInput,
  SyncTx,
} from '../../sync/domain/sync.types';
import {
  parseMealCreate,
  parseMealUpdate,
  parseNutritionLogCreate,
  parseNutritionLogUpdate,
} from '../domain/nutrition-container-payload';
import {
  MEAL_ENTITY_TYPE,
  NUTRITION_LOG_ENTITY_TYPE,
} from '../domain/nutrition-container.types';
import {
  mealToWire,
  nutritionLogToWire,
  PrismaNutritionContainerRepository,
} from './prisma-nutrition-container.repository';

/**
 * `nutrition_logs` sync handler (BUG-044). A day's log is a structural
 * container with a deterministic id (user + date), so a CREATE that finds the
 * same live row — another device, or a retry — is already satisfied, never a
 * conflict. Owner-scoped wellness data; `notes` is never written by the app
 * today and is redacted from conflict snapshots anyway.
 *
 * No conflict review: containers have no user-editable fields, so a handler
 * without `readCurrentOwnedRow` keeps them out of the review screen
 * (ADR-P030 §Decision 12).
 */
@Injectable()
export class NutritionLogSyncHandler implements EntitySyncHandler {
  readonly entityType = NUTRITION_LOG_ENTITY_TYPE;

  constructor(private readonly repo: PrismaNutritionContainerRepository) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedLog(tx, userId, entityId);
    return record
      ? {
          version: record.version,
          snapshot: this.redactForConflict(nutritionLogToWire(record)),
        }
      : null;
  }

  isEquivalentCreate(
    serverState: ServerEntityState,
    op: SyncOperationInput,
  ): boolean {
    try {
      const date = parseNutritionLogCreate(op.payload)
        .date.toISOString()
        .slice(0, 10);
      return (
        serverState.snapshot.deleted_at === null &&
        serverState.snapshot.date === date
      );
    } catch {
      return false;
    }
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE':
        affected = await this.repo.createLog(
          tx,
          userId,
          op.entityId,
          parseNutritionLogCreate(op.payload),
        );
        break;
      case 'UPDATE':
        affected = await this.repo.updateLog(
          tx,
          userId,
          op.entityId,
          parseNutritionLogUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteLog(
          tx,
          userId,
          op.entityId,
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
    const records = await this.repo.logsChangedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: nutritionLogToWire(record),
    }));
  }

  redactForConflict(payload: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...payload };
    delete redacted.notes;
    return redacted;
  }
}

/**
 * `meals` sync handler (BUG-044). One meal per day and slot, with a
 * deterministic id (user + date + slot). Its parent log may not have reached
 * the server yet — a retryable `DEPENDENCY_NOT_READY`, never a rejection; a
 * parent owned by someone else, or deleted, is a hard error.
 */
@Injectable()
export class MealSyncHandler implements EntitySyncHandler {
  readonly entityType = MEAL_ENTITY_TYPE;

  constructor(private readonly repo: PrismaNutritionContainerRepository) {}

  async getServerState(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<ServerEntityState | null> {
    const record = await this.repo.findOwnedMeal(tx, userId, entityId);
    return record
      ? { version: record.version, snapshot: mealToWire(record) }
      : null;
  }

  isEquivalentCreate(
    serverState: ServerEntityState,
    op: SyncOperationInput,
  ): boolean {
    try {
      const input = parseMealCreate(op.payload);
      return (
        serverState.snapshot.deleted_at === null &&
        serverState.snapshot.nutrition_log_id === input.nutritionLogId &&
        serverState.snapshot.type === input.type
      );
    } catch {
      return false;
    }
  }

  async apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome> {
    let affected: number;
    switch (op.operation) {
      case 'CREATE': {
        const input = parseMealCreate(op.payload);
        const log = await this.repo.findLog(tx, input.nutritionLogId);
        if (!log) {
          throw new SyncApplyError(SYNC_ERROR_CODES.DEPENDENCY_NOT_READY, true);
        }
        if (log.userId !== userId || log.deletedAt !== null) {
          throw new Error('meal parent log is not an active log of this user');
        }
        affected = await this.repo.createMeal(tx, userId, op.entityId, input);
        break;
      }
      case 'UPDATE':
        affected = await this.repo.updateMeal(
          tx,
          userId,
          op.entityId,
          parseMealUpdate(op.payload),
          op.baseVersion,
        );
        break;
      case 'DELETE':
        affected = await this.repo.softDeleteMeal(
          tx,
          userId,
          op.entityId,
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
    const records = await this.repo.mealsChangedSince(userId, sinceSeq, limit);
    return records.map((record) => ({
      entityType: this.entityType,
      entityId: record.id,
      syncSeq: record.syncSeq,
      deleted: record.deletedAt !== null,
      data: mealToWire(record),
    }));
  }
}
