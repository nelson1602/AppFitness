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

export class SyncHttpError extends Error {
  constructor(readonly status: number) {
    super(`Sync request failed (${status})`);
    this.name = 'SyncHttpError';
  }
}

export interface SyncTransport {
  push(operations: PushOperation[]): Promise<PushOperationResult[]>;
  pull(since: number, entityTypes: string[], limit: number): Promise<PullResponse>;
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
  };
}
