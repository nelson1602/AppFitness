import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSession, getStatus, restoreSession, subscribe } from '../application/session-manager';
import type { AuthUser } from '../domain/session.types';
import { useSession } from './use-session';

// Fully mock the session-manager so the hook's subscription and
// restore-on-unknown effect can be driven deterministically.
jest.mock('../application/session-manager', () => ({
  getStatus: jest.fn(),
  getSession: jest.fn(),
  subscribe: jest.fn(() => () => {}),
  restoreSession: jest.fn(),
}));

const mockGetStatus = jest.mocked(getStatus);
const mockGetSession = jest.mocked(getSession);
const mockSubscribe = jest.mocked(subscribe);
const mockRestoreSession = jest.mocked(restoreSession);

const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};

describe('useSession hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStatus.mockReturnValue('unknown');
    mockGetSession.mockReturnValue(null);
    mockSubscribe.mockReturnValue(() => {});
  });

  it('returns the current session snapshot and subscribes to the store', async () => {
    mockGetStatus.mockReturnValue('authenticated');
    mockGetSession.mockReturnValue({ accessToken: 'a', refreshToken: 'r', user });

    const { result } = await renderHook(() => useSession());

    expect(result.current.status).toBe('authenticated');
    expect(result.current.session?.user.id).toBe('user-1');
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('restores the session on mount when the status is unknown', async () => {
    mockGetStatus.mockReturnValue('unknown');

    await renderHook(() => useSession());

    await waitFor(() => expect(mockRestoreSession).toHaveBeenCalledTimes(1));
  });

  it('does not restore when the session is already resolved', async () => {
    mockGetStatus.mockReturnValue('authenticated');
    mockGetSession.mockReturnValue({ accessToken: 'a', refreshToken: 'r', user });

    await renderHook(() => useSession());

    // Give the effect a chance to (not) fire.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRestoreSession).not.toHaveBeenCalled();
  });

  it('re-renders with the new snapshot when the store notifies a change', async () => {
    let notify: () => void = () => {};
    mockSubscribe.mockImplementation((cb) => {
      notify = cb as unknown as () => void;
      return () => {};
    });
    mockGetStatus.mockReturnValue('unknown');

    const { result } = await renderHook(() => useSession());
    expect(result.current.status).toBe('unknown');

    // The store transitions to authenticated and notifies subscribers.
    mockGetStatus.mockReturnValue('authenticated');
    mockGetSession.mockReturnValue({ accessToken: 'a', refreshToken: 'r', user });
    act(() => notify());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.session?.user.id).toBe('user-1');
  });
});
