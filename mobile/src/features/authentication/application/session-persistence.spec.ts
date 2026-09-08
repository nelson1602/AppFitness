import * as SecureStore from 'expo-secure-store';

import type { AuthUser, Session } from '../domain/session.types';
import * as authApi from '../infrastructure/auth-api';
import { AuthApiError } from '../infrastructure/auth-api';
import { loadSession } from '../infrastructure/session-storage';
import {
  AuthError,
  deleteAccount,
  getSession,
  getSessionSnapshot,
  getStatus,
  refreshTokens,
  refreshUser,
  requireSessionSnapshot,
  resetPassword,
  restoreSession,
  signIn,
  signOut,
  signUp,
} from './session-manager';

// The structural audit at the end of this file reads the module it guards as
// text. That runs in Node under Jest, but the React Native tsconfig ships no
// Node type definitions and none are added for it, so the sliver used here is
// declared locally — the same approach `node-sqlite.d.ts` takes for the
// migration tests.
declare const __dirname: string;
declare function require(id: 'node:fs'): { readFileSync(file: string, encoding: 'utf8'): string };

/**
 * Account-isolation regressions at the PERSISTENCE boundary (ADR-P030 C-1).
 *
 * `session-manager.spec.ts` mocks `session-storage`, so it can only prove what
 * the manager *intended* to write. That is exactly the gap the C-1 audit was
 * asked to close: a rotation could be "discarded" in memory while stale bytes
 * stayed on disk, and the next restore would rebuild the mixed session.
 *
 * This suite therefore runs the REAL `session-storage` over a fake SecureStore
 * and asserts what `loadSession()` returns afterwards — the state a process
 * restart would actually see. Interleavings are driven by deferred promises,
 * never timers, so each race is exact and deterministic.
 */

const mockStore = new Map<string, string>();

/**
 * A pending write gate. A real SecureStore write completes asynchronously, so
 * the fake applies the value on RESOLUTION rather than on call — that is what
 * lets a test order two concurrent writes and observe which one lands last.
 */
let mockWriteGate: { promise: Promise<void>; hit: () => void } | null = null;
/**
 * Release for whatever gate the running test armed. A test that fails between
 * arming a write and releasing it would otherwise leave the session lock held
 * forever and time out every *later* test instead of only itself.
 */
let releaseArmedGate: (() => void) | null = null;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    const gate = mockWriteGate;
    if (!gate) {
      mockStore.set(k, v);
      return Promise.resolve();
    }
    mockWriteGate = null;
    gate.hit();
    return gate.promise.then(() => {
      mockStore.set(k, v);
    });
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  }),
}));
jest.mock('../infrastructure/auth-api', () => ({
  ...jest.requireActual('../infrastructure/auth-api'),
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  deleteAccount: jest.fn(),
  me: jest.fn(),
  resetPassword: jest.fn(),
}));
jest.mock('../infrastructure/local-user.repository', () => ({
  ensureLocalUser: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/infrastructure/database', () => ({
  wipeDatabase: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const SESSION_KEY = 'auth.session.v1';
const LEGACY = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  user: 'auth.user',
} as const;

const mockLogin = jest.mocked(authApi.login);
const mockRefresh = jest.mocked(authApi.refresh);
const mockMe = jest.mocked(authApi.me);
const mockLogout = jest.mocked(authApi.logout);
const mockDeleteAccount = jest.mocked(authApi.deleteAccount);
const mockResetPassword = jest.mocked(authApi.resetPassword);
const mockRegister = jest.mocked(authApi.register);
const logError = jest.requireMock('../../../shared/infrastructure/logging').logError as jest.Mock;
const mockWipeDatabase = jest.mocked(
  jest.requireMock('../../../shared/infrastructure/database') as {
    wipeDatabase: jest.Mock;
  },
).wipeDatabase;

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

function sessionFor(id: string): Session {
  return {
    accessToken: `${id}-access`,
    refreshToken: `${id}-refresh`,
    user: userFor(id),
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Signs `id` in through the real manager, so storage and memory both move. */
async function signInAs(id: string): Promise<Session> {
  const session = sessionFor(id);
  mockLogin.mockResolvedValue(session);
  const outcome = await signIn({
    email: session.user.email,
    password: 'disposable-pw-12345',
  });
  if (outcome.status !== 'authenticated') throw new Error('sign-in was superseded');
  return outcome.session;
}

beforeEach(async () => {
  mockStore.clear();
  mockWriteGate = null;
  jest.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
  // Start every test from a clean signed-out state, in storage AND memory.
  await signOut();
  mockStore.clear();
  jest.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
});

afterEach(() => {
  releaseArmedGate?.();
  releaseArmedGate = null;
  mockWriteGate = null;
});

/**
 * Arms the NEXT SecureStore write to hang until `release()`. `reached`
 * resolves once that write has actually been issued, so the interleaving
 * needs no timer and no polling.
 */
function armWriteGate(): { reached: Promise<void>; release: () => void } {
  let release!: () => void;
  let hit!: () => void;
  const promise = new Promise<void>((res) => {
    release = res;
  });
  const reached = new Promise<void>((res) => {
    hit = res;
  });
  mockWriteGate = { promise, hit };
  releaseArmedGate = release;
  return { reached, release };
}

/** What a process restart would rebuild from disk. */
async function persisted(): Promise<Session | null> {
  return loadSession();
}

describe('persisted session never mixes one account with another', () => {
  it("discards A's rotation that completes after B signs in — disk stays B", async () => {
    await signInAs('user-a');
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    await signInAs('user-b');

    pending.resolve({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });
    await expect(rotating).resolves.toBeNull();

    // The decisive assertion: what a restart would load.
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()).toEqual(sessionFor('user-b'));
  });

  it("does not sign B out when A's refresh token is rejected", async () => {
    await signInAs('user-a');
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);

    const rotating = refreshTokens();
    await signInAs('user-b');

    pending.reject(new AuthApiError(401, 'revoked'));
    await expect(rotating).resolves.toBeNull();

    // A 401 is a statement about A's token only.
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
    expect(getSession()?.user.id).toBe('user-b');
  });

  it("discards A's refreshUser response after B signs in", async () => {
    await signInAs('user-a');
    const pending = deferred<AuthUser>();
    mockMe.mockReturnValue(pending.promise);

    const reading = refreshUser();
    await signInAs('user-b');

    // The renamed user A the server returned must not become B's identity.
    pending.resolve({ ...userFor('user-a'), username: 'renamed-a' });
    await expect(reading).resolves.toBeNull();

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()?.user.username).toBe('user-b');
  });

  it('lets a newer authentication win over a slow restore', async () => {
    // A session is on disk from a previous run…
    await signInAs('user-a');
    await signOut();
    mockStore.clear();
    await signInAs('user-a');
    const onDisk = await persisted();
    expect(onDisk).toEqual(sessionFor('user-a'));

    // …and the process restarts: memory is stale but storage holds A.
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);
    const restoring = restoreSession();

    // The user signs in as B before the restore's rotation returns.
    await signInAs('user-b');

    pending.resolve({ accessToken: 'a-access-3', refreshToken: 'a-refresh-3' });
    await expect(restoring).resolves.toBeNull();

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()?.user.id).toBe('user-b');
  });

  it("does not let A's slow sign-out end B's session", async () => {
    await signInAs('user-a');
    const pending = deferred<void>();
    mockLogout.mockReturnValue(pending.promise);

    const signingOut = signOut();
    await signInAs('user-b');

    pending.resolve();
    await signingOut;

    // B stays signed in, on disk and in memory.
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
    expect(getSession()?.user.id).toBe('user-b');
  });

  it("does not let A's account deletion wipe or sign out B", async () => {
    await signInAs('user-a');
    const pending = deferred<void>();
    mockDeleteAccount.mockReturnValue(pending.promise);

    const deleting = deleteAccount();
    await signInAs('user-b');

    pending.resolve();
    await deleting;

    // The destructive half is withheld entirely: B's data and session survive.
    expect(mockWipeDatabase).not.toHaveBeenCalled();
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
    expect(getSession()?.user.id).toBe('user-b');
  });

  it('deletes normally when the captured account is still current', async () => {
    await signInAs('user-a');
    mockDeleteAccount.mockResolvedValue(undefined);

    await deleteAccount();

    expect(mockWipeDatabase).toHaveBeenCalledTimes(1);
    await expect(persisted()).resolves.toBeNull();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('does not let a password reset sign out an account that authenticated during it', async () => {
    const pending = deferred<void>();
    mockResetPassword.mockReturnValue(pending.promise);

    const resetting = resetPassword({ token: 'reset-token', password: 'new-pw-12345' });
    await signInAs('user-b');

    pending.resolve();
    await resetting;

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
  });

  /**
   * The discriminating test for SERIALIZATION, as opposed to the generation
   * check. Both are needed: the generation check is made before the write, but
   * the write itself awaits, so without the lock a sign-in can issue its own
   * write concurrently and the LAST one to land wins. If A's rotation lands
   * last, storage holds a complete-but-stale A session and the next restart
   * signs the user back in as A after they switched to B.
   *
   * With the lock, B's sign-in queues behind A's critical section, so the
   * final write is always the newest session.
   */
  it('serializes writes so an in-flight rotation cannot land after a newer sign-in', async () => {
    await signInAs('user-a');
    mockRefresh.mockResolvedValue({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });

    const gate = armWriteGate();
    const rotating = refreshTokens();
    await gate.reached; // A's write is provably issued and hanging

    // B signs in while that write is outstanding.
    const signingIn = signInAs('user-b');
    gate.release();
    await Promise.all([rotating, signingIn]);

    // The newest session is what a restart would load.
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()?.user.id).toBe('user-b');
  });

  it('rotates and persists normally when nothing else intervenes', async () => {
    await signInAs('user-a');
    mockRefresh.mockResolvedValue({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });

    const rotated = await refreshTokens();

    expect(rotated).toEqual({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user: userFor('user-a'),
    });
    // The persisted triple moved together — user AND both tokens.
    await expect(persisted()).resolves.toEqual({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user: userFor('user-a'),
    });
  });
});

describe('process restart rebuilds only a verifiable session', () => {
  /**
   * A complete legacy triple is NOT migrated: the implementation that wrote
   * those keys could persist one account's tokens beside another's user, so
   * the triple is unverifiable however well-formed it looks. The restore ends
   * signed out with nothing retained.
   */
  it('refuses a complete legacy triple and requires a fresh sign-in', async () => {
    const legacy = sessionFor('user-a');
    mockStore.set(LEGACY.accessToken, legacy.accessToken);
    mockStore.set(LEGACY.refreshToken, legacy.refreshToken);
    mockStore.set(LEGACY.user, JSON.stringify(legacy.user));

    await expect(restoreSession()).resolves.toBeNull();

    expect(getStatus()).toBe('unauthenticated');
    expect(mockStore.size).toBe(0);
    // No token was ever presented to the server on its behalf.
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refuses a PARTIAL legacy state and requires authentication', async () => {
    // Two of three keys. Rejected for the same reason as a complete triple.
    const legacy = sessionFor('user-a');
    mockStore.set(LEGACY.accessToken, legacy.accessToken);
    mockStore.set(LEGACY.user, JSON.stringify(legacy.user));

    await expect(restoreSession()).resolves.toBeNull();

    expect(getStatus()).toBe('unauthenticated');
    expect(mockStore.size).toBe(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refuses an unverifiable envelope and requires authentication', async () => {
    mockStore.set(SESSION_KEY, JSON.stringify({ v: 1, accessToken: 'a', user: { id: 'x' } }));

    await expect(restoreSession()).resolves.toBeNull();

    expect(getStatus()).toBe('unauthenticated');
    expect(mockStore.size).toBe(0);
  });

  it('restores a migrated envelope on the next start', async () => {
    await signInAs('user-a');
    // Exactly what the previous run left behind.
    expect([...mockStore.keys()]).toEqual([SESSION_KEY]);
    mockRefresh.mockResolvedValue({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });

    await expect(restoreSession()).resolves.toEqual({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user: userFor('user-a'),
    });
  });

  it('keeps the stored session when the network is down (offline-first)', async () => {
    await signInAs('user-a');
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));

    await expect(restoreSession()).resolves.toEqual(sessionFor('user-a'));
    expect(getStatus()).toBe('authenticated');
    await expect(persisted()).resolves.toEqual(sessionFor('user-a'));
  });
});

/**
 * A reset token comes from an emailed link and proves nothing about which
 * account is signed in on THIS device. Clearing the session was wrong in both
 * directions, and both are asserted at the storage level.
 */
describe('password reset never disturbs an unrelated session', () => {
  it('leaves B untouched when B was already authenticated before the reset', async () => {
    await signInAs('user-b');
    const deletesBefore = jest.mocked(SecureStore.deleteItemAsync).mock.calls.length;
    const pending = deferred<void>();
    mockResetPassword.mockReturnValue(pending.promise);

    const resetting = resetPassword({ token: 'a-reset-token', password: 'new-pw-12345' });
    pending.resolve();
    await resetting;

    // Recognised and recorded, not merely blocked by a downstream check: the
    // reset never owned this device's session, so it takes the early exit and
    // attempts no storage work at all.
    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'auth.resetPassword.sessionPreserved',
      expect.any(Error),
    );
    expect(jest.mocked(SecureStore.deleteItemAsync).mock.calls.length).toBe(deletesBefore);

    // B's refresh token is not ours to discard on A's behalf.
    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
    expect(getSession()?.user.id).toBe('user-b');
  });

  it(`ignores a session cleared mid-reset by an unrelated 401`, async () => {
    // B is authenticated when the reset begins, then B's own refresh is
    // rejected and clears the session with no explicit intent. The reset must
    // still recognise that it never owned this device's session.
    await signInAs('user-b');
    const pending = deferred<void>();
    mockResetPassword.mockReturnValue(pending.promise);
    const resetting = resetPassword({ token: 'a-reset-token', password: 'new-pw-12345' });

    mockRefresh.mockRejectedValue(new AuthApiError(401, 'revoked'));
    await refreshTokens();
    expect(getStatus()).toBe('unauthenticated');
    const deletesAfter401 = jest.mocked(SecureStore.deleteItemAsync).mock.calls.length;

    pending.resolve();
    await resetting;

    expect(jest.mocked(logError)).toHaveBeenCalledWith(
      'auth.resetPassword.sessionPreserved',
      expect.any(Error),
    );
    // No further storage work and no extra transition on the reset's behalf.
    expect(jest.mocked(SecureStore.deleteItemAsync).mock.calls.length).toBe(deletesAfter401);
  });

  it('leaves B untouched when B signs in while the reset is pending', async () => {
    const pending = deferred<void>();
    mockResetPassword.mockReturnValue(pending.promise);

    const resetting = resetPassword({ token: 'a-reset-token', password: 'new-pw-12345' });
    await signInAs('user-b');

    pending.resolve();
    await resetting;

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getStatus()).toBe('authenticated');
  });

  it('still clears when the reset began and finished signed out', async () => {
    // The one case where clearing is correct: this device held a session for
    // (plausibly) the reset account, and nothing replaced it.
    await signInAs('user-a');
    await signOut();
    await signInAs('user-a');
    mockResetPassword.mockResolvedValue(undefined);
    // Signed out at the moment the reset begins.
    await signOut();

    await resetPassword({ token: 'a-reset-token', password: 'new-pw-12345' });

    await expect(persisted()).resolves.toBeNull();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('reports success even when the local clear fails', async () => {
    await signOut();
    mockResetPassword.mockResolvedValue(undefined);
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockRejectedValueOnce(new Error('keychain unavailable'));

    // The password DID change server-side; a storage failure must not make
    // the operation look failed.
    await expect(
      resetPassword({ token: 'a-reset-token', password: 'new-pw-12345' }),
    ).resolves.toBeUndefined();
  });
});

/**
 * Two overlapping explicit authentications. Generation cannot order these —
 * neither has published anything, so neither is stale by generation — yet only
 * the user's latest intent may win. `authIntent` supplies that ordering.
 */
/**
 * Intent reservation is linearized with persistence: it queues on the same
 * mutex, so the acquisition IS the ordering point.
 *
 * Before that, a synchronous claim outside the lock left a window in which A
 * could pass its check, begin its write, be superseded by B, return
 * `superseded` — and still leave its bytes on disk. If B then failed, nothing
 * replaced them and a restart restored an attempt the user had explicitly
 * abandoned. An issued SecureStore write cannot be recalled, so the guarantee
 * is about ordering, not cancellation.
 */
describe('intent reservation is linearized with persistence', () => {
  it('makes a newer reservation wait for the in-flight commit, and never strands its write', async () => {
    mockLogin.mockResolvedValueOnce(sessionFor('user-a'));

    // Block A inside its SecureStore write, mid-critical-section.
    const gate = armWriteGate();
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });
    await gate.reached;

    // B is invoked while A holds the lock. Its reservation must not be granted
    // yet — proven by the fact that A, which re-checks nothing after this
    // point, still commits successfully below.
    const b = deferred<Session>();
    mockLogin.mockReturnValueOnce(b.promise);
    const signingInB = signIn({ email: 'b@x', password: 'disposable-pw-12345' });
    // Drain the microtask queue: nothing but the gate is holding B back, so if
    // the reservation were granted outside the lock B would reach the network
    // here. It cannot — the mutex is held by A until the gate opens. (Asserting
    // this without the drain would prove nothing: a synchronous claim also
    // needs a tick to get to the request.)
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    // B has not even reached the network: the reservation is still queued.
    expect(mockLogin).toHaveBeenCalledTimes(1);

    gate.release();

    // A's transaction completed as a whole: memory AND storage are A.
    await expect(signingInA).resolves.toMatchObject({ status: 'authenticated' });
    expect(getSession()?.user.id).toBe('user-a');
    await expect(persisted()).resolves.toEqual(sessionFor('user-a'));

    // Only now does B get its intent and its request.
    await Promise.resolve();
    expect(mockLogin).toHaveBeenCalledTimes(2);

    // B then fails, so nothing supersedes A.
    b.reject(new AuthApiError(401, 'invalid credentials'));
    await expect(signingInB).rejects.toBeInstanceOf(AuthError);

    // The last successfully linearized state is A, in memory and on disk.
    expect(getSession()?.user.id).toBe('user-a');
    await expect(persisted()).resolves.toEqual(sessionFor('user-a'));

    // Simulated restart: what comes back is that same committed identity —
    // never a superseded or half-committed one.
    mockRefresh.mockResolvedValue({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });
    await expect(restoreSession()).resolves.toEqual({
      accessToken: 'a-access-2',
      refreshToken: 'a-refresh-2',
      user: userFor('user-a'),
    });
  });

  it('leaves no persisted trace when the newer intent is reserved before the write begins', async () => {
    // The retained case: B reserves while A is still on the NETWORK, so A
    // never enters its critical section. A must write nothing at all.
    const a = deferred<Session>();
    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });

    const b = deferred<Session>();
    mockLogin.mockReturnValueOnce(b.promise);
    const signingInB = signIn({ email: 'b@x', password: 'disposable-pw-12345' });
    await Promise.resolve();
    const writesBefore = jest.mocked(SecureStore.setItemAsync).mock.calls.length;

    a.resolve(sessionFor('user-a'));
    await expect(signingInA).resolves.toEqual({ status: 'superseded' });

    // Not one byte of A reached storage.
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.length).toBe(writesBefore);
    await expect(persisted()).resolves.toBeNull();

    b.reject(new AuthApiError(401, 'invalid credentials'));
    await expect(signingInB).rejects.toBeInstanceOf(AuthError);

    // Both attempts are gone; a restart authenticates nobody.
    await expect(persisted()).resolves.toBeNull();
    await expect(restoreSession()).resolves.toBeNull();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('serializes a sign-out reservation behind an in-flight commit', async () => {
    mockLogin.mockResolvedValueOnce(sessionFor('user-a'));
    const gate = armWriteGate();
    const signingIn = signIn({ email: 'a@x', password: 'disposable-pw-12345' });
    await gate.reached;

    // Sign-out reserves through the same lock, so it queues too.
    const signingOut = signOut();
    gate.release();

    await expect(signingIn).resolves.toMatchObject({ status: 'authenticated' });
    await signingOut;

    // The sign-out is ordered AFTER the commit it waited for, so it wins and
    // both memory and storage end signed out — never one of each.
    expect(getStatus()).toBe('unauthenticated');
    await expect(persisted()).resolves.toBeNull();
  });

  /**
   * The structural half of the audit: the invariant holds because there is
   * exactly ONE writer of the counter and it sits inside the lock helper. A
   * future synchronous claim added anywhere else would re-open the window, and
   * no behavioural test would necessarily catch it — so assert the shape.
   */
  it('mutates the intent counter from exactly one place, inside the lock', () => {
    const source = require('node:fs').readFileSync(`${__dirname}/session-manager.ts`, 'utf8');

    // Every assignment/increment of the counter, excluding its declaration.
    const body = source.replace(/let authIntent = 0;/, '');
    const mutations = body.match(/authIntent\s*(?:\+=|--|\+\+|=(?!=))/g) ?? [];
    expect(mutations).toEqual(['authIntent +=']);

    // …and it is inside `reserveAuthIntent`, whose body is a `withSessionLock`
    // critical section.
    const reserve = /function reserveAuthIntent\(\)[\s\S]*?\n}/.exec(source);
    expect(reserve).not.toBeNull();
    expect(reserve?.[0]).toContain('withSessionLock');
    expect(reserve?.[0]).toContain('authIntent += 1');

    // No caller bumps it directly.
    expect(source).not.toContain('claimAuthIntent');
  });
});

describe('the latest explicit authentication intent wins', () => {
  it('B wins when B completes FIRST and A lands last', async () => {
    const a = deferred<Session>();
    const b = deferred<Session>();

    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });
    mockLogin.mockReturnValueOnce(b.promise);
    const signingInB = signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    b.resolve(sessionFor('user-b'));
    await expect(signingInB).resolves.toEqual({
      status: 'authenticated',
      session: sessionFor('user-b'),
    });

    a.resolve(sessionFor('user-a'));
    await expect(signingInA).resolves.toEqual({ status: 'superseded' });

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()?.user.id).toBe('user-b');
  });

  it('B wins when A completes FIRST and B lands last', async () => {
    const a = deferred<Session>();
    const b = deferred<Session>();

    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });
    mockLogin.mockReturnValueOnce(b.promise);
    const signingInB = signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    a.resolve(sessionFor('user-a'));
    await expect(signingInA).resolves.toEqual({ status: 'superseded' });

    b.resolve(sessionFor('user-b'));
    await expect(signingInB).resolves.toMatchObject({ status: 'authenticated' });

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
  });

  it('a superseded attempt neither writes storage nor exposes a Session', async () => {
    const a = deferred<Session>();
    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });

    mockLogin.mockResolvedValueOnce(sessionFor('user-b'));
    await signIn({ email: 'b@x', password: 'disposable-pw-12345' });
    const writesAfterB = jest.mocked(SecureStore.setItemAsync).mock.calls.length;

    a.resolve(sessionFor('user-a'));
    const outcome = await signingInA;

    expect(outcome).toEqual({ status: 'superseded' });
    expect('session' in outcome).toBe(false);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls.length).toBe(writesAfterB);
  });

  it('a superseded FAILURE does not throw, so no stale error can be shown', async () => {
    const a = deferred<Session>();
    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });

    mockLogin.mockResolvedValueOnce(sessionFor('user-b'));
    await signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    // A's attempt fails AFTER B succeeded. Throwing would put a credential
    // banner on the screen of a user who is signed in.
    a.reject(new AuthApiError(401, 'invalid credentials'));
    await expect(signingInA).resolves.toEqual({ status: 'superseded' });

    expect(getSession()?.user.id).toBe('user-b');
  });

  it('the older attempt is not published when the newest one fails', async () => {
    const a = deferred<Session>();
    const b = deferred<Session>();

    mockLogin.mockReturnValueOnce(a.promise);
    const signingInA = signIn({ email: 'a@x', password: 'disposable-pw-12345' });
    mockLogin.mockReturnValueOnce(b.promise);
    const signingInB = signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    b.reject(new AuthApiError(401, 'invalid credentials'));
    await expect(signingInB).rejects.toBeInstanceOf(AuthError);

    // A is still superseded: the user asked for B, and B failing does not
    // reinstate an intent they abandoned.
    a.resolve(sessionFor('user-a'));
    await expect(signingInA).resolves.toEqual({ status: 'superseded' });

    await expect(persisted()).resolves.toBeNull();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('sign-out invalidates a pending sign-in', async () => {
    const a = deferred<Session>();
    mockLogin.mockReturnValueOnce(a.promise);
    const signingIn = signIn({ email: 'a@x', password: 'disposable-pw-12345' });

    await signOut();

    a.resolve(sessionFor('user-a'));
    await expect(signingIn).resolves.toEqual({ status: 'superseded' });

    // The user asked to be signed out; a slow sign-in cannot undo that.
    await expect(persisted()).resolves.toBeNull();
    expect(getStatus()).toBe('unauthenticated');
  });

  it('registration is ordered by the same intent epoch', async () => {
    const a = deferred<Session>();
    mockRegister.mockReturnValue(a.promise);
    const registering = signUp({
      email: 'a@x',
      username: 'a',
      password: 'disposable-pw-12345',
    });

    mockLogin.mockResolvedValueOnce(sessionFor('user-b'));
    await signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    a.resolve(sessionFor('user-a'));
    await expect(registering).resolves.toEqual({ status: 'superseded' });

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
  });

  it('a pending restore cannot publish once an explicit sign-in begins', async () => {
    // Storage holds A from a previous run; the restore is mid-flight when the
    // user explicitly signs in as B.
    await signInAs('user-a');
    const rotation = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(rotation.promise);
    const restoring = restoreSession();

    mockLogin.mockResolvedValueOnce(sessionFor('user-b'));
    await signIn({ email: 'b@x', password: 'disposable-pw-12345' });

    rotation.resolve({ accessToken: 'a-access-9', refreshToken: 'a-refresh-9' });
    await expect(restoring).resolves.toBeNull();

    await expect(persisted()).resolves.toEqual(sessionFor('user-b'));
    expect(getSession()?.user.id).toBe('user-b');
  });
});

/**
 * The snapshot claims to be immutable. `readonly` is compile-time only, and
 * freezing the wrapper leaves a shared `user` reference mutable — so anything
 * holding the original Session could retarget an in-flight operation.
 */
describe('a captured snapshot cannot be retargeted', () => {
  it('is unaffected by mutating the original session user object', async () => {
    const session = await signInAs('user-a');
    const captured = requireSessionSnapshot();

    // Whatever a holder of the live session does to it…
    (session.user as { id: string }).id = 'user-b';
    (session as { accessToken: string }).accessToken = 'stolen';

    // …the capture still describes the account it was taken for.
    expect(captured.userId).toBe('user-a');
    expect(captured.user.id).toBe('user-a');
    expect(captured.accessToken).toBe(sessionFor('user-a').accessToken);
  });

  it('ignores direct mutation of the snapshot and of its user', async () => {
    await signInAs('user-a');
    const captured = requireSessionSnapshot();

    // Frozen at BOTH levels: the wrapper and the copied user.
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.user)).toBe(true);

    // Whether the write throws depends on the strictness of the calling code,
    // so the assertion is on the outcome that actually matters: the captured
    // owner is unchanged either way.
    try {
      (captured as { userId: string }).userId = 'user-b';
      (captured.user as { id: string }).id = 'user-b';
    } catch {
      // Strict-mode callers get a TypeError; both outcomes are acceptable.
    }

    expect(captured.userId).toBe('user-a');
    expect(captured.user.id).toBe('user-a');
  });

  it('gives each capture its own user copy', async () => {
    await signInAs('user-a');
    const first = requireSessionSnapshot();
    const second = getSessionSnapshot();

    expect(second?.user).not.toBe(first.user);
    expect(second?.user).toEqual(first.user);
  });
});

describe('no account identifier reaches the logs', () => {
  it('logs only stable reason strings, never tokens or ids', async () => {
    await signInAs('user-a');
    const pending = deferred<{ accessToken: string; refreshToken: string }>();
    mockRefresh.mockReturnValue(pending.promise);
    const rotating = refreshTokens();
    await signInAs('user-b');
    pending.resolve({ accessToken: 'a-access-2', refreshToken: 'a-refresh-2' });
    await rotating;

    const logged = jest.mocked(
      jest.requireMock('../../../shared/infrastructure/logging') as { logError: jest.Mock },
    ).logError;
    const serialized = JSON.stringify(
      logged.mock.calls.map(([tag, err]) => [tag, err instanceof Error ? err.message : err]),
    );
    expect(serialized).not.toMatch(/access|refresh|user-a|user-b|@appfitness/i);
  });
});
