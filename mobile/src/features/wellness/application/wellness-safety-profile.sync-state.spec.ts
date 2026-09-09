import { getSession } from '@/features/authentication';
import { listPendingConflicts } from '@/shared/infrastructure/sync';
import type { SyncConflictRow } from '@/shared/infrastructure/database/types';

import { hasUnsyncedWellnessSafetyProfileChange } from './wellness-safety-profile.service';
import { getWellnessSafetyProfileSyncState } from './wellness-safety-profile.sync-state';

/**
 * ADR-P017 **W-3** sync-state reporting.
 *
 * W-2's dirty probe cannot separate "queued" from "diverged" — both leave
 * `sync_status != 'synced'` — and the two states have opposite copy
 * obligations. These assertions pin the precedence and prove that the conflict
 * rows' payloads (which carry the token lists) are never read.
 */

jest.mock('@/features/authentication', () => ({ getSession: jest.fn() }));
jest.mock('@/shared/infrastructure/sync', () => ({ listPendingConflicts: jest.fn() }));
jest.mock('./wellness-safety-profile.service', () => ({
  hasUnsyncedWellnessSafetyProfileChange: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockConflicts = jest.mocked(listPendingConflicts);
const mockDirty = jest.mocked(hasUnsyncedWellnessSafetyProfileChange);

const A = '11111111-1111-4111-8111-111111111111';

function conflictRow(entityType: string, payload: Record<string, unknown>): SyncConflictRow {
  return {
    id: `conflict-${entityType}`,
    user_id: A,
    entity_type: entityType,
    entity_id: A,
    local_payload: JSON.stringify(payload),
    server_payload: JSON.stringify(payload),
    base_version: 1,
    server_version: 2,
    status: 'PENDING',
    created_at: '2026-09-09T10:00:00.000Z',
    resolved_at: null,
  } as SyncConflictRow;
}

function signedIn(userId: string): void {
  mockGetSession.mockReturnValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    user: {
      id: userId,
      email: `${userId}@example.com`,
      username: userId,
      role: 'USER',
      phone: null,
      avatarUrl: null,
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  signedIn(A);
  mockConflicts.mockResolvedValue([]);
  mockDirty.mockResolvedValue(false);
});

it('reports synced when nothing is queued and nothing diverged', async () => {
  await expect(getWellnessSafetyProfileSyncState()).resolves.toBe('synced');
});

it('reports pending for a queued local write', async () => {
  mockDirty.mockResolvedValue(true);
  await expect(getWellnessSafetyProfileSyncState()).resolves.toBe('pending');
});

it('reports conflict for a diverged wellness row', async () => {
  mockConflicts.mockResolvedValue([conflictRow('wellness_safety_profiles', { a: 1 })]);
  await expect(getWellnessSafetyProfileSyncState()).resolves.toBe('conflict');
});

it('prefers conflict over pending, since a diverged row is also dirty', async () => {
  mockConflicts.mockResolvedValue([conflictRow('wellness_safety_profiles', { a: 1 })]);
  mockDirty.mockResolvedValue(true);

  await expect(getWellnessSafetyProfileSyncState()).resolves.toBe('conflict');
  // Precedence is decided before the probe runs, so the reassuring "pending"
  // wording can never win over a divergence.
  expect(mockDirty).not.toHaveBeenCalled();
});

it('ignores another entity type conflict', async () => {
  mockConflicts.mockResolvedValue([
    conflictRow('body_weights', { a: 1 }),
    conflictRow('dietary_preferences', { a: 1 }),
  ]);

  await expect(getWellnessSafetyProfileSyncState()).resolves.toBe('synced');
});

it('scopes the conflict query to the authenticated user', async () => {
  await getWellnessSafetyProfileSyncState();
  expect(mockConflicts).toHaveBeenCalledWith(A);
});

it('re-reads the session per call, so an account switch is picked up', async () => {
  const B = '22222222-2222-4222-8222-222222222222';
  await getWellnessSafetyProfileSyncState();
  signedIn(B);
  await getWellnessSafetyProfileSyncState();

  expect(mockConflicts.mock.calls.map(([userId]) => userId)).toEqual([A, B]);
});

it('rejects without a session and touches nothing', async () => {
  mockGetSession.mockReturnValue(null);

  await expect(getWellnessSafetyProfileSyncState()).rejects.toThrow('Not authenticated');
  expect(mockConflicts).not.toHaveBeenCalled();
  expect(mockDirty).not.toHaveBeenCalled();
});

it('returns only a state word — no token, payload or row escapes', async () => {
  mockConflicts.mockResolvedValue([
    conflictRow('wellness_safety_profiles', {
      affected_areas: ['knee'],
      movements_to_avoid: ['jumping'],
    }),
  ]);

  const state = await getWellnessSafetyProfileSyncState();

  expect(typeof state).toBe('string');
  expect(JSON.stringify(state)).not.toContain('knee');
  expect(JSON.stringify(state)).not.toContain('jumping');
});
