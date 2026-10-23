import { act, renderHook } from '@testing-library/react-native';

import { initializeWelcomeGate, markWelcomeSeen, useWelcomePending } from './welcome-gate';

type Status = 'unknown' | 'authenticated' | 'unauthenticated';
type Session = { user: { id: string } } | null;

let mockStatus: Status = 'unknown';
let mockSession: Session = null;
const mockListeners: ((status: Status, session: Session) => void)[] = [];

jest.mock('@/features/authentication', () => ({
  getStatus: () => mockStatus,
  getSession: () => mockSession,
  subscribe: (listener: (status: Status, session: Session) => void) => {
    mockListeners.push(listener);
    return () => {};
  },
}));

/** Drive the session manager the way sign-in, restore and sign-out do. */
async function transition(status: Status, userId: string | null = null): Promise<void> {
  mockStatus = status;
  mockSession = userId ? { user: { id: userId } } : null;
  await act(async () => mockListeners.forEach((listener) => listener(status, mockSession)));
}

beforeAll(() => {
  initializeWelcomeGate();
  initializeWelcomeGate();
});

beforeEach(async () => {
  // A known start: launch, then nobody signed in.
  await transition('unknown');
});

describe('welcome gate (ADR-P039 D5)', () => {
  it('installs one listener however often it is initialised', () => {
    expect(mockListeners).toHaveLength(1);
  });

  it('is owed after a sign-in, to that account', async () => {
    await transition('unauthenticated');
    const { result } = await renderHook(() => useWelcomePending());
    expect(result.current).toBe(false);

    await transition('authenticated', 'user-a');
    expect(result.current).toBe(true);
  });

  it('is not owed for a session restored at launch', async () => {
    const { result } = await renderHook(() => useWelcomePending());

    await transition('authenticated', 'user-a');
    expect(result.current).toBe(false);
  });

  it('is cleared once seen, and stays cleared on token refreshes', async () => {
    await transition('unauthenticated');
    await transition('authenticated', 'user-a');
    const { result } = await renderHook(() => useWelcomePending());
    expect(result.current).toBe(true);

    await act(async () => markWelcomeSeen());
    expect(result.current).toBe(false);

    await transition('authenticated', 'user-a');
    expect(result.current).toBe(false);
  });

  it('is cleared by a sign-out before it is seen', async () => {
    await transition('unauthenticated');
    await transition('authenticated', 'user-a');
    const { result } = await renderHook(() => useWelcomePending());

    await transition('unauthenticated');
    expect(result.current).toBe(false);
  });

  it('never carries over to a different account', async () => {
    await transition('unauthenticated');
    await transition('authenticated', 'user-a');
    const { result } = await renderHook(() => useWelcomePending());

    await transition('authenticated', 'user-b');
    expect(result.current).toBe(false);
  });
});
