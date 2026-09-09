import { getSession } from '@/features/authentication';

import {
  getWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfile,
  saveWellnessSafetyProfile,
  softDeleteWellnessSafetyProfile,
} from '../infrastructure/wellness-safety-profile.repository';
import {
  deleteMyWellnessSafetyProfile,
  getMyWellnessSafetyProfile,
  hasUnsyncedWellnessSafetyProfileChange,
  saveMyWellnessSafetyProfile,
} from './wellness-safety-profile.service';

/**
 * ADR-P017 **W-2** application boundary.
 *
 * The service has one job — resolve the authenticated account and pass it down
 * — so the assertions are about exactly that: nothing reaches the repository
 * without a session, and the id that reaches it is the session's, not an
 * argument a caller could supply. The injected calendar date is checked here
 * too, because it is the seam the future-date rule depends on.
 */

jest.mock('@/features/authentication', () => ({ getSession: jest.fn() }));
jest.mock('../infrastructure/wellness-safety-profile.repository', () => ({
  getWellnessSafetyProfile: jest.fn(),
  saveWellnessSafetyProfile: jest.fn(),
  softDeleteWellnessSafetyProfile: jest.fn(),
  hasUnsyncedWellnessSafetyProfile: jest.fn(),
}));

const mockGetSession = jest.mocked(getSession);
const mockGet = jest.mocked(getWellnessSafetyProfile);
const mockSave = jest.mocked(saveWellnessSafetyProfile);
const mockDelete = jest.mocked(softDeleteWellnessSafetyProfile);
const mockDirty = jest.mocked(hasUnsyncedWellnessSafetyProfile);

const A = '11111111-1111-4111-8111-111111111111';

const INPUT = {
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee'],
  movementsToAvoid: ['jumping'],
};

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
  mockGet.mockResolvedValue(null);
  mockSave.mockResolvedValue({
    id: A,
    userId: A,
    evaluationCompleted: true,
    evaluationDate: '2026-01-02',
    affectedAreas: ['knee'],
    movementsToAvoid: ['jumping'],
    createdAt: '2026-09-09T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
    version: 1,
    deletedAt: null,
    deletedBy: null,
  });
  mockDelete.mockResolvedValue(true);
  mockDirty.mockResolvedValue(false);
});

describe('unauthenticated calls reject before touching the repository', () => {
  const calls: [label: string, call: () => Promise<unknown>][] = [
    ['get', () => getMyWellnessSafetyProfile()],
    ['save', () => saveMyWellnessSafetyProfile(INPUT)],
    ['delete', () => deleteMyWellnessSafetyProfile()],
    ['dirty probe', () => hasUnsyncedWellnessSafetyProfileChange()],
  ];

  it.each(calls)('%s throws with no session', async (_label, call) => {
    mockGetSession.mockReturnValue(null);

    await expect(Promise.resolve().then(() => call())).rejects.toThrow('Not authenticated');

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDirty).not.toHaveBeenCalled();
  });
});

describe('the authenticated user id is what reaches the repository', () => {
  beforeEach(() => {
    signedIn(A);
  });

  it('forwards it to get', async () => {
    await getMyWellnessSafetyProfile();
    expect(mockGet).toHaveBeenCalledWith(A);
  });

  it('forwards it to save', async () => {
    await saveMyWellnessSafetyProfile(INPUT);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toBe(A);
    expect(mockSave.mock.calls[0][1]).toEqual(INPUT);
  });

  it('forwards it to delete', async () => {
    await deleteMyWellnessSafetyProfile();
    expect(mockDelete).toHaveBeenCalledWith(A);
  });

  it('forwards it to the dirty probe', async () => {
    await hasUnsyncedWellnessSafetyProfileChange();
    expect(mockDirty).toHaveBeenCalledWith(A);
  });

  it('re-reads the session per call, so an account switch is picked up', async () => {
    const B = '22222222-2222-4222-8222-222222222222';
    await getMyWellnessSafetyProfile();
    signedIn(B);
    await getMyWellnessSafetyProfile();

    expect(mockGet.mock.calls.map(([userId]) => userId)).toEqual([A, B]);
  });
});

describe('save passes the current date into domain validation', () => {
  beforeEach(() => {
    signedIn(A);
  });

  it('forwards an explicitly injected calendar date', async () => {
    await saveMyWellnessSafetyProfile(INPUT, '2026-03-04');
    expect(mockSave.mock.calls[0][3]).toBe('2026-03-04');
  });

  it('defaults to the device-local calendar date', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 9, 23, 30, 0));
    try {
      await saveMyWellnessSafetyProfile(INPUT);
      // Device-local, not UTC: a UTC-derived default could read 2026-09-10.
      expect(mockSave.mock.calls[0][3]).toBe('2026-09-09');
      // The write timestamp is an ISO instant, passed explicitly rather than
      // left to the repository default.
      expect(mockSave.mock.calls[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      jest.useRealTimers();
    }
  });
});
