import type { AuthUser, Session, SessionStatus } from '../domain/session.types';
import type { SessionSnapshot } from '../application/session-manager';

/**
 * A faithful in-memory stand-in for the `@/features/authentication` module,
 * for specs of user-scoped stores (ADR-P030 C-1).
 *
 * It exists because the obvious alternatives are both unsound:
 *
 * - **No mock.** The real `session-manager` starts with no session, so
 *   `requireSessionSnapshot()` throws and every store spec fails. That is how
 *   these specs used to pass *while bypassing the session boundary entirely* —
 *   the store never touched a session, only its mocked service did.
 * - **A stub returning `true`.** `isSessionCurrent: () => true` would make
 *   every account-isolation guard vacuous and every regression below green for
 *   the wrong reason.
 *
 * This double implements the real contract instead: a generation counter that
 * increments on every transition, snapshots frozen at capture time, and
 * `isSessionCurrent` comparing both generation and owner. Switching accounts
 * mid-flight therefore invalidates outstanding snapshots exactly as production
 * does, and the store's guards are genuinely exercised.
 *
 * Used only from specs; nothing in the app imports it.
 */

export interface FakeSessionModule {
  // ── the mocked surface ────────────────────────────────────────────────────
  getSession(): Session | null;
  getAccessToken(): string | null;
  getStatus(): SessionStatus;
  getSessionSnapshot(): SessionSnapshot | null;
  requireSessionSnapshot(): SessionSnapshot;
  isSessionCurrent(snapshot: SessionSnapshot): boolean;
  bindStoreToSession(reset: () => void): void;
  subscribe(listener: (status: SessionStatus, session: Session | null) => void): () => void;
  refreshTokens: jest.Mock<Promise<Session | null>, []>;

  // ── test controls ─────────────────────────────────────────────────────────
  /** Signs `userId` in, replacing any current account (bumps the generation). */
  becomeUser(userId: string, overrides?: Partial<Session>): Session;
  /** Signs out (bumps the generation). */
  endSession(): void;
}

function userFor(userId: string): AuthUser {
  return {
    id: userId,
    email: `${userId}@appfitness.local`,
    username: userId,
    role: 'USER',
    phone: null,
    avatarUrl: null,
  };
}

export function createFakeSessionModule(): FakeSessionModule {
  let session: Session | null = null;
  let status: SessionStatus = 'unknown';
  let generation = 0;
  const listeners = new Set<(s: SessionStatus, v: Session | null) => void>();

  function transition(next: Session | null, nextStatus: SessionStatus): void {
    generation += 1;
    session = next;
    status = nextStatus;
    for (const listener of listeners) listener(nextStatus, next);
  }

  function snapshot(of: Session): SessionSnapshot {
    return Object.freeze({
      generation,
      userId: of.user.id,
      accessToken: of.accessToken,
      refreshToken: of.refreshToken,
      user: of.user,
    });
  }

  return {
    getSession: () => session,
    getAccessToken: () => session?.accessToken ?? null,
    getStatus: () => status,
    getSessionSnapshot: () => (session ? snapshot(session) : null),
    requireSessionSnapshot: () => {
      if (!session) throw new Error('Not authenticated');
      return snapshot(session);
    },
    // The real comparison, not `true`: generation AND owner must both match.
    isSessionCurrent: (captured) =>
      captured.generation === generation && session?.user.id === captured.userId,
    bindStoreToSession: (reset) => {
      let owner: string | null = session?.user.id ?? null;
      listeners.add((_s, next) => {
        const id = next?.user.id ?? null;
        if (id === owner) return;
        owner = id;
        reset();
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refreshTokens: jest.fn<Promise<Session | null>, []>(),

    becomeUser: (userId, overrides = {}) => {
      const next: Session = {
        accessToken: `${userId}-access`,
        refreshToken: `${userId}-refresh`,
        user: userFor(userId),
        ...overrides,
      };
      transition(next, 'authenticated');
      return next;
    },
    endSession: () => transition(null, 'unauthenticated'),
  };
}
