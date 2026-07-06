import { SyncOperationStatus, SyncOperationType } from '@prisma/client';

/** One client-originated operation (mirrors the mobile sync_queue row). */
export interface SyncOperationInput {
  opId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperationType;
  /** Server version the client edit was based on (0 for CREATE). */
  baseVersion: number;
  /** Row snapshot as produced by the client. Validated by the entity handler. */
  payload: Record<string, unknown>;
}

export interface SyncOperationResult {
  opId: string;
  status: SyncOperationStatus;
  /** True when the op had already been processed (idempotent retry). */
  duplicate: boolean;
  errorCode: string | null;
  /** Present when status is CONFLICT. */
  conflictId?: string;
  /** Server version at conflict time — lets the client record the conflict locally. */
  serverVersion?: number;
  /** Server row snapshot at conflict time (wire shape). */
  serverSnapshot?: Record<string, unknown>;
}

/** Current server-side state of an entity row, for conflict detection. */
export interface ServerEntityState {
  version: number;
  snapshot: Record<string, unknown>;
}

/** One changed row in a pull response. Must include the sync cursor. */
export interface PulledChange {
  entityType: string;
  entityId: string;
  syncSeq: number;
  deleted: boolean;
  data: Record<string, unknown>;
}

/**
 * Per-entity sync handler. Feature modules (Phases 6+) implement and
 * register one handler per synchronized entity; the sync pipeline itself
 * stays entity-agnostic. `apply` is responsible for validating the
 * payload before writing — the pipeline never writes domain rows itself.
 */
export interface EntitySyncHandler {
  readonly entityType: string;
  getServerState(
    userId: string,
    entityId: string,
  ): Promise<ServerEntityState | null>;
  apply(userId: string, op: SyncOperationInput): Promise<void>;
  pullChanges(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<PulledChange[]>;
  /**
   * Optional: strips sensitive fields before a payload/snapshot is
   * persisted into sync_conflicts (medical free-text must never sit in
   * plaintext JSONB — ADR-P006). Pull payloads are NOT redacted (they
   * travel over TLS to the owner only).
   */
  redactForConflict?(payload: Record<string, unknown>): Record<string, unknown>;
}

export const SYNC_ERROR_CODES = {
  ENTITY_NOT_SUPPORTED: 'ENTITY_NOT_SUPPORTED',
  NOT_FOUND: 'NOT_FOUND',
  APPLY_FAILED: 'APPLY_FAILED',
} as const;
