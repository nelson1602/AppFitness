import * as SecureStore from 'expo-secure-store';

import { logError } from '../../../shared/infrastructure/logging';
import type { Session } from '../domain/session.types';
import { clearSession, loadSession, saveSession, saveTokens } from './session-storage';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  }),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
}));

const session: Session = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: {
    id: 'user-1',
    email: 'demo@appfitness.local',
    username: 'demo',
    role: 'USER',
    phone: null,
    avatarUrl: null,
  },
};

describe('session storage (SecureStore only — .ai/05_SECURITY.md)', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('saves and restores a full session', async () => {
    await saveSession(session);
    await expect(loadSession()).resolves.toEqual(session);
  });

  it('stores tokens only under SecureStore keys, never elsewhere', async () => {
    await saveSession(session);

    expect(
      jest
        .mocked(SecureStore.setItemAsync)
        .mock.calls.map(([k]) => k)
        .sort(),
    ).toEqual(['auth.accessToken', 'auth.refreshToken', 'auth.user']);
    expect(mockStore.get('auth.accessToken')).toBe('access-1');
  });

  it('returns null when any session piece is missing (never half-restores)', async () => {
    await saveSession(session);
    mockStore.delete('auth.refreshToken');

    await expect(loadSession()).resolves.toBeNull();
  });

  it('clears everything and reports the error when the stored user is corrupted', async () => {
    await saveSession(session);
    mockStore.set('auth.user', '{not json');

    await expect(loadSession()).resolves.toBeNull();
    expect(jest.mocked(logError)).toHaveBeenCalledWith('auth.loadSession', expect.anything());
    expect(mockStore.has('auth.accessToken')).toBe(false);
    expect(mockStore.has('auth.refreshToken')).toBe(false);
    expect(mockStore.has('auth.user')).toBe(false);
  });

  it('saveTokens rotates tokens without touching the stored user', async () => {
    await saveSession(session);
    await saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });

    await expect(loadSession()).resolves.toEqual({
      ...session,
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
  });

  it('clearSession removes all three entries', async () => {
    await saveSession(session);
    await clearSession();

    expect(mockStore.size).toBe(0);
    await expect(loadSession()).resolves.toBeNull();
  });
});
