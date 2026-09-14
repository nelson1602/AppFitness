import type { SyncOperationType } from '../database/types';

/** HTTP client for the api/ sync endpoints (contracts mirror the server DTOs). */

const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PushOperation {
  opId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperationType;
  baseVersion: number;
  payload: Record<string, unknown>;
}

export interface PushOperationResult {
  opId: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  duplicate: boolean;
  errorCode: string | null;
  conflictId?: string;
  serverVersion?: number;
  serverSnapshot?: Record<string, unknown>;
}

export interface PulledChange {
  entityType: string;
  entityId: string;
  syncSeq: number;
  deleted: boolean;
  data: Record<string, unknown>;
}

export interface PullResponse {
  changes: PulledChange[];
  nextCursor: number;
  hasMore: boolean;
}

// ── Conflict resolution (ADR-P030 C-3 contract) ──────────────────────────────

/** Server-side resolution vocabulary. The local store uses its own (Decision 3). */
export type ConflictResolutionChoice = 'CLIENT_WINS' | 'SERVER_WINS';

/** The authoritative row every non-404 resolve outcome carries. */
export interface AuthoritativeRow {
  row: Record<string, unknown>;
  version: number;
  deleted: boolean;
}

export interface ResolveConflictRequest {
  resolution: ConflictResolutionChoice;
  expectedServerVersion: number;
  expectedDeleted: boolean;
  /** `CLIENT_WINS` only — the retained local operation. Omitted for SERVER_WINS. */
  operation?: SyncOperationType;
  payload?: Record<string, unknown>;
}

/**
 * The endpoint's stable machine-readable outcomes. These are **codes, not
 * prose**: no server-authored user-facing string exists in this contract, and
 * nothing else from the response body is read.
 */
export const RESOLVE_OUTCOMES = [
  'RESOLVED',
  'ALREADY_RESOLVED_SAME_CHOICE',
  'ALREADY_RESOLVED_OPPOSITE_CHOICE',
  'STALE_COMPARISON',
  'RESTORE_UNSUPPORTED',
] as const;

export type ResolveOutcomeCode = (typeof RESOLVE_OUTCOMES)[number];

export interface ResolveConflictOutcome {
  outcome: ResolveOutcomeCode;
  /** Present on the outcomes that name a standing decision. */
  resolution?: ConflictResolutionChoice;
  current: AuthoritativeRow;
}

/** Status-only reconciliation result for one locally-known id (Decision 9). */
export interface ConflictStatusEntry {
  id: string;
  status: string;
}

export interface ListConflictsResponse {
  conflicts: {
    id: string;
    entityType: string;
    entityId: string;
    clientVersion: number;
    serverVersion: number;
    status: string;
    createdAt: string;
  }[];
  statuses: ConflictStatusEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export class SyncHttpError extends Error {
  constructor(readonly status: number) {
    super(`Sync request failed (${status})`);
    this.name = 'SyncHttpError';
  }
}

export interface SyncTransport {
  push(operations: PushOperation[]): Promise<PushOperationResult[]>;
  pull(since: number, entityTypes: string[], limit: number): Promise<PullResponse>;
  /** Owner-scoped pending set plus status-only reconciliation for known ids. */
  listConflicts(options?: {
    ids?: string[];
    cursor?: string;
    limit?: number;
  }): Promise<ListConflictsResponse>;
  /**
   * Resolve one conflict. Both the 200 and the 409 bodies are typed outcomes,
   * so a 409 is a normal answer here rather than an error; anything else
   * (400/404/5xx/malformed) throws `SyncHttpError`, which carries a status and
   * no server text.
   */
  resolveConflict(
    conflictId: string,
    request: ResolveConflictRequest,
  ): Promise<ResolveConflictOutcome>;
}

/**
 * Reads ONLY the fields this contract defines, and only when they have the
 * expected shape. An unrecognised or malformed body is a protocol failure, not
 * something to act on — no server-authored text can reach the caller.
 */
function parseResolveOutcome(body: unknown, status: number): ResolveConflictOutcome {
  if (typeof body !== 'object' || body === null) throw new SyncHttpError(status);

  const { outcome, resolution, current } = body as {
    outcome?: unknown;
    resolution?: unknown;
    current?: unknown;
  };
  if (!RESOLVE_OUTCOMES.some((code) => code === outcome)) throw new SyncHttpError(status);
  if (typeof current !== 'object' || current === null) throw new SyncHttpError(status);

  const snapshot = current as { row?: unknown; version?: unknown; deleted?: unknown };
  if (
    typeof snapshot.row !== 'object' ||
    snapshot.row === null ||
    typeof snapshot.version !== 'number' ||
    typeof snapshot.deleted !== 'boolean'
  ) {
    throw new SyncHttpError(status);
  }

  return {
    outcome: outcome as ResolveOutcomeCode,
    ...(resolution === 'CLIENT_WINS' || resolution === 'SERVER_WINS' ? { resolution } : {}),
    current: {
      row: snapshot.row as Record<string, unknown>,
      version: snapshot.version,
      deleted: snapshot.deleted,
    },
  };
}

export function createSyncTransport(
  getToken: () => string | null,
  baseUrl: string = DEFAULT_BASE_URL,
): SyncTransport {
  const authHeaders = (): Record<string, string> => {
    const token = getToken();
    if (!token) throw new SyncHttpError(401);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  return {
    async push(operations) {
      const response = await fetch(`${baseUrl}/sync/push`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ operations }),
      });
      if (!response.ok) throw new SyncHttpError(response.status);
      const body = (await response.json()) as { results: PushOperationResult[] };
      return body.results;
    },

    async pull(since, entityTypes, limit) {
      const params = new URLSearchParams({
        since: String(since),
        limit: String(limit),
        entityTypes: entityTypes.join(','),
      });
      const response = await fetch(`${baseUrl}/sync/pull?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new SyncHttpError(response.status);
      return (await response.json()) as PullResponse;
    },

    async listConflicts(options = {}) {
      const params = new URLSearchParams();
      if (options.cursor) params.set('cursor', options.cursor);
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      if (options.ids?.length) params.set('ids', options.ids.join(','));
      const query = params.toString();
      const response = await fetch(`${baseUrl}/sync/conflicts${query ? `?${query}` : ''}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new SyncHttpError(response.status);
      return (await response.json()) as ListConflictsResponse;
    },

    async resolveConflict(conflictId, request) {
      const response = await fetch(`${baseUrl}/sync/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(request),
      });
      // 200 and 409 are both typed outcomes of this contract (Decision 3);
      // every other status is a transport/protocol failure.
      if (!response.ok && response.status !== 409) throw new SyncHttpError(response.status);
      return parseResolveOutcome(await response.json(), response.status);
    },
  };
}
