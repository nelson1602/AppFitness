import type {
  ConflictResolutionStatus,
  SyncConflictRow,
  SyncOperationType,
  SyncQueueRow,
} from '../database/types';

/**
 * Input for enqueueing a local change. `opId` is minted by the caller
 * (repositories) — it becomes the server-side idempotency key, so it must
 * be a UUID generated once per logical operation, never per retry.
 */
export interface EnqueueInput {
  opId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperationType;
  /** Row snapshot at enqueue time (will be JSON-serialized). */
  payload: Record<string, unknown>;
  /** Server version the edit was based on (0 for CREATE). */
  baseVersion: number;
  /**
   * Medical/highly-sensitive payloads: stored encrypted in the queue
   * (device field cipher, ADR-P001) — plaintext never sits in
   * sync_queue.payload. The worker decrypts just before pushing.
   */
  sensitive?: boolean;
}

/** Server outcome for one pushed operation (mirrors the API contract). */
export interface ServerOperationOutcome {
  opId: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  errorCode: string | null;
  conflictId?: string;
  serverVersion?: number;
  serverSnapshot?: Record<string, unknown>;
}

export interface RecordConflictInput {
  id: string;
  entityType: string;
  entityId: string;
  localPayload: Record<string, unknown>;
  serverPayload: Record<string, unknown>;
  baseVersion: number;
  serverVersion: number;
}

export type { ConflictResolutionStatus, SyncConflictRow, SyncQueueRow };
