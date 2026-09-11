import type { Prisma } from '@prisma/client';
import { SyncOperationStatus, SyncOperationType } from '@prisma/client';

/**
 * The transaction-scoped Prisma client threaded through one push operation
 * (ADR-P030 §Decision 3, slice C-2).
 *
 * Every read and write of a single `/sync/push` operation — the idempotency
 * probe, the server-state read, the handler mutation, any `SyncConflict`, and
 * the terminal `SyncOperation` row — runs on **this** client, so they commit
 * or roll back together. It is passed explicitly and is **never optional**:
 * a helper that could fall back to the root client would silently escape the
 * transaction and reintroduce the mutation-without-recorded-op-id hole that
 * §Decision 3 exists to close.
 */
export type SyncTx = Prisma.TransactionClient;

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

/**
 * The result of a handler's `apply` (ADR-P030 §Decision 3).
 *
 * `void` had no channel for "the conditional mutation matched nothing", so a
 * late race surfaced as a generic rejection and the client dropped the
 * operation. `STALE` is a **returned value, not a throw**, so it never aborts
 * the surrounding transaction and its `SyncConflict` + `SyncOperation` rows
 * commit inside it.
 *
 * - `UPDATE` / `DELETE` report `STALE` when the owner + expected-version +
 *   tombstone predicate matched zero rows.
 * - `CREATE` reports `STALE` in exactly one case: the insert collided on the
 *   primary key, i.e. the row now exists. Every other constraint violation
 *   still throws and keeps its current classification.
 */
export type ApplyOutcome = { status: 'APPLIED' } | { status: 'STALE' };

/**
 * The authoritative current row for one owned entity, unredacted, in the wire
 * shape `pullChanges` already produces (ADR-P030 §Decision 3).
 *
 * Added by C-2 so the resolution slice (C-3) has a reader to build its typed
 * response from. **No endpoint consumes it yet.**
 */
export interface OwnedRowSnapshot {
  row: Record<string, unknown>;
  version: number;
  deleted: boolean;
}

/**
 * One conflict resolution expressed against an entity's own semantics
 * (ADR-P030 §Decision 3). `apply()` is deliberately **not** reused: a retained
 * `CREATE` would fail on the primary key, and a partial `UPDATE` treated as a
 * full representation would erase the fields it omits.
 *
 * Added by C-2 so C-3 has a mutation to call. **No endpoint calls it yet.**
 */
export interface ResolutionMutationInput {
  /** The client's retained original operation. */
  operation: SyncOperationType;
  /** The retained payload, parsed by the entity’s own create/update parser. */
  payload: Record<string, unknown>;
  /** The version the user reviewed; also the predicate and the new version − 1. */
  expectedServerVersion: number;
  /** The tombstone state the user reviewed; selects the tombstone predicate. */
  expectedDeleted: boolean;
}

/**
 * A retained conflict payload failed the entity parser. C-3 maps this typed
 * boundary to HTTP 400 without mistaking repository or database failures for
 * client input errors.
 */
export class InvalidConflictPayloadError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'INVALID_CONFLICT_PAYLOAD');
    this.name = 'InvalidConflictPayloadError';
  }
}

/** Wrap only synchronous entity parsing, never the repository mutation. */
export function parseConflictPayload<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new InvalidConflictPayloadError(error);
  }
}

/**
 * A retained DELETE reviewed against a tombstone is already satisfied.
 * Resolution must settle it without touching the row or bumping its version
 * (ADR-P030 §Decision 3).
 */
export function isAlreadySatisfiedDelete(input: {
  operation: SyncOperationType;
  expectedDeleted: boolean;
}): boolean {
  return input.operation === SyncOperationType.DELETE && input.expectedDeleted;
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
    tx: SyncTx,
  ): Promise<ServerEntityState | null>;
  apply(
    userId: string,
    op: SyncOperationInput,
    tx: SyncTx,
  ): Promise<ApplyOutcome>;
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
  /**
   * Owner-scoped **unredacted** current row (ADR-P030 §Decision 3).
   *
   * Present on every public-V1 handler. A handler without it is an
   * **unsupported** conflict entity (§Decision 12) — the dormant medical
   * handlers are exactly that, and deliberately do not implement it.
   */
  readCurrentOwnedRow?(
    userId: string,
    entityId: string,
    tx: SyncTx,
  ): Promise<OwnedRowSnapshot | null>;
  /**
   * One conditional resolution mutation carrying owner, expected version and
   * the state-specific tombstone predicate (ADR-P030 §Decision 3). Returns the
   * **affected-row count**: `1` means the resolution committed. `0` means
   * either the row moved (typed stale) or a DELETE reviewed against a tombstone
   * was already satisfied; the caller distinguishes those cases from the
   * request's `operation` + `expectedDeleted` pair.
   *
   * Same support rule as `readCurrentOwnedRow`.
   */
  resolveConflictMutation?(
    userId: string,
    entityId: string,
    input: ResolutionMutationInput,
    tx: SyncTx,
  ): Promise<number>;
}

export const SYNC_ERROR_CODES = {
  ENTITY_NOT_SUPPORTED: 'ENTITY_NOT_SUPPORTED',
  NOT_FOUND: 'NOT_FOUND',
  APPLY_FAILED: 'APPLY_FAILED',
  // ADR-P012 (Slice 4A — definitions only; no handler consumes these yet).
  // Retryable: a child op whose parent has not yet applied (FK/missing parent).
  // The mobile worker must treat this as FAILED-with-backoff and RETRY it,
  // never removeRejected() it.
  DEPENDENCY_NOT_READY: 'DEPENDENCY_NOT_READY',
  // Non-retryable but must be surfaced as an actionable failure: a meal_item
  // references a catalog food revision the server does not recognise/support.
  // The local operation must NOT be silently discarded.
  CATALOG_REVISION_UNSUPPORTED: 'CATALOG_REVISION_UNSUPPORTED',
} as const;

export type SyncErrorCode =
  (typeof SYNC_ERROR_CODES)[keyof typeof SYNC_ERROR_CODES];

/**
 * Thrown by an `EntitySyncHandler.apply` to carry a specific sync error code
 * (ADR-P012). The pipeline treats it distinctly from a generic failure:
 *
 * - `retryable: true` (e.g. `DEPENDENCY_NOT_READY` — a child whose parent has
 *   not yet synced): the pipeline does NOT persist a terminal outcome, so the
 *   same operation UUID re-processes on a later retry once the dependency is
 *   ready. The op is never permanently rejected.
 * - `retryable: false` (e.g. `CATALOG_REVISION_UNSUPPORTED`): the pipeline
 *   records a terminal `REJECTED` with this code — actionable and idempotent
 *   (a replay returns the same recorded outcome), never silently discarded.
 *
 * A plain `Error` remains a generic `APPLY_FAILED` rejection.
 */
export class SyncApplyError extends Error {
  constructor(
    readonly errorCode: SyncErrorCode,
    readonly retryable: boolean,
  ) {
    super(errorCode);
    this.name = 'SyncApplyError';
  }
}
