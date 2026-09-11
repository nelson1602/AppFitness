import type { ConflictStatus, SyncOperationType } from '@prisma/client';

import type { OwnedRowSnapshot } from './sync.types';

export const CONFLICT_RESOLUTIONS = ['CLIENT_WINS', 'SERVER_WINS'] as const;
export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number];

export interface ResolveConflictInput {
  resolution: ConflictResolution;
  expectedServerVersion: number;
  expectedDeleted: boolean;
  operation?: SyncOperationType;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

export interface PendingConflictSummary {
  id: string;
  entityType: string;
  entityId: string;
  clientVersion: number;
  serverVersion: number;
  status: ConflictStatus;
  createdAt: Date;
}

export interface ConflictStatusSummary {
  id: string;
  status: ConflictStatus;
}

export interface ListConflictsResult {
  conflicts: PendingConflictSummary[];
  statuses: ConflictStatusSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type ResolveConflictResponse =
  | {
      outcome: 'RESOLVED' | 'ALREADY_RESOLVED_SAME_CHOICE';
      resolution: ConflictResolution;
      current: OwnedRowSnapshot;
    }
  | {
      outcome: 'STALE_COMPARISON' | 'RESTORE_UNSUPPORTED';
      current: OwnedRowSnapshot;
    }
  | {
      outcome: 'ALREADY_RESOLVED_OPPOSITE_CHOICE';
      resolution: ConflictResolution;
      current: OwnedRowSnapshot;
    };
