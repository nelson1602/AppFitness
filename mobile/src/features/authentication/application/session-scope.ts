import { getSession, subscribe } from './session-manager';

/**
 * Binds a store's cached state to the signed-in account (ADR-P030 Decision 8 /
 * C-1).
 *
 * Guarding every async publication is necessary but not sufficient: after a
 * switch, a store still holds the *previous* account's rows, and any screen
 * mounted before the new account's load finishes would render them. Nothing
 * asynchronous is involved, so no snapshot check catches it.
 *
 * `bindStoreToSession` calls `reset` the moment the owning account changes —
 * including sign-out (owner becomes `null`) and a direct A → B switch. The
 * reset is synchronous with the session transition, so there is no frame in
 * which B sees A's data.
 *
 * Registered once at module scope by each user-scoped store. The subscription
 * intentionally lives for the process lifetime: a store module is a singleton,
 * and unsubscribing would silently re-open the leak.
 */
export function bindStoreToSession(reset: () => void): void {
  let owner: string | null = getSession()?.user.id ?? null;

  subscribe((_status, session) => {
    const next = session?.user.id ?? null;
    if (next === owner) return;
    owner = next;
    reset();
  });
}
