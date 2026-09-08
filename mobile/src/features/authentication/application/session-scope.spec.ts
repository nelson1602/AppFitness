import type { AuthUser, Session } from '../domain/session.types';
import * as authApi from '../infrastructure/auth-api';
import { signIn, signOut } from './session-manager';
import { bindStoreToSession } from './session-scope';

/**
 * Direct spec for the production binder (ADR-P030 C-1).
 *
 * `account-switch.spec.ts` proves each store resets, but it mocks the
 * authentication barrel — so it exercises the *test double's* binder, not this
 * one. Neutering `session-scope.ts` left that suite green, which is exactly the
 * kind of false positive the C-1 audit was asked to find. This suite drives the
 * real `subscribe` wiring through real sign-in / sign-out transitions.
 */

jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  logout: jest.fn(() => Promise.resolve()),
}));
jest.mock('../infrastructure/session-storage', () => ({
  saveSession: jest.fn(() => Promise.resolve()),
  loadSession: jest.fn(() => Promise.resolve(null)),
  clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../infrastructure/local-user.repository', () => ({
  ensureLocalUser: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockLogin = jest.mocked(authApi.login);

function userFor(id: string): AuthUser {
  return {
    id,
    email: `${id}@appfitness.local`,
    username: id,
    role: 'USER',
    phone: null,
    avatarUrl: null,
  };
}

async function signInAs(id: string): Promise<Session> {
  const session: Session = {
    accessToken: `${id}-access`,
    refreshToken: `${id}-refresh`,
    user: userFor(id),
  };
  mockLogin.mockResolvedValue(session);
  const outcome = await signIn({
    email: session.user.email,
    password: 'disposable-pw-12345',
  });
  if (outcome.status !== 'authenticated') throw new Error('sign-in was superseded');
  return outcome.session;
}

describe('bindStoreToSession', () => {
  beforeEach(async () => {
    await signOut();
    jest.clearAllMocks();
  });

  it('resets when a different account signs in', async () => {
    await signInAs('user-a');
    const reset = jest.fn();
    bindStoreToSession(reset);

    await signInAs('user-b');

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('resets on sign-out', async () => {
    await signInAs('user-a');
    const reset = jest.fn();
    bindStoreToSession(reset);

    await signOut();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does NOT reset when the same account is re-established', async () => {
    // A token rotation or a `refreshUser` publishes a new session object for
    // the SAME owner. Resetting there would wipe a live screen for no reason.
    await signInAs('user-a');
    const reset = jest.fn();
    bindStoreToSession(reset);

    await signInAs('user-a');

    expect(reset).not.toHaveBeenCalled();
  });

  it('resets once per transition, not once per listener notification', async () => {
    await signInAs('user-a');
    const reset = jest.fn();
    bindStoreToSession(reset);

    await signInAs('user-b');
    await signInAs('user-b');
    await signOut();

    // b (1) → b again (no-op) → signed out (2)
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('resets each registered store independently', async () => {
    await signInAs('user-a');
    const first = jest.fn();
    const second = jest.fn();
    bindStoreToSession(first);
    bindStoreToSession(second);

    await signInAs('user-b');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('binds to whoever is current at registration time', async () => {
    // Registering while A is signed in must not immediately fire, and must
    // still fire on the move to B.
    await signInAs('user-a');
    const reset = jest.fn();
    bindStoreToSession(reset);
    expect(reset).not.toHaveBeenCalled();

    await signInAs('user-b');
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
