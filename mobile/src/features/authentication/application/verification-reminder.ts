/**
 * Dismissal state for the dashboard verification reminder (ADR-P026 V2-D).
 *
 * **Memory only, for the current authenticated session — by owner decision
 * (2026-09-02) and the V2-B state matrix.** Never written to SQLite, never sent
 * to the server, never persisted anywhere. A dismissal that survived a restart
 * would be a persisted preference, which is a different feature and is not
 * authorized.
 *
 * Three resets follow from that, and all three are covered:
 *
 * - **Sign-out / session loss** — `session-manager` calls `resetDismissal()`
 *   whenever it transitions to `unauthenticated`.
 * - **A different account** — the dismissal records *which* user id dismissed
 *   it, so a session belonging to anyone else is not treated as dismissed even
 *   if the reset above were somehow missed. Defence in depth, not the primary
 *   mechanism.
 * - **App restart** — this is module state in a fresh JavaScript context, so
 *   it starts empty with no code required.
 *
 * The tiny subscription mirrors `use-session.ts` so the reminder re-renders on
 * dismissal without a global state library (Zustand is for feature state, not
 * for one boolean that must not outlive the session).
 */

let dismissedForUserId: string | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Hide the reminder for the remainder of THIS authenticated session. */
export function dismissReminder(userId: string): void {
  if (dismissedForUserId === userId) return;
  dismissedForUserId = userId;
  notify();
}

/** True only when this exact user dismissed it in the current session. */
export function isReminderDismissed(userId: string): boolean {
  return dismissedForUserId !== null && dismissedForUserId === userId;
}

/**
 * Forget any dismissal. Called on every transition to `unauthenticated`, so a
 * sign-out or an expired session brings the reminder back next time.
 */
export function resetDismissal(): void {
  if (dismissedForUserId === null) return;
  dismissedForUserId = null;
  notify();
}

/** Subscribe to dismissal changes; returns an unsubscribe function. */
export function subscribeToReminder(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Snapshot for `useSyncExternalStore`.
 *
 * Returns a primitive, so React's `Object.is` comparison is stable without any
 * caching — unlike the session snapshot, which has to memoise an object.
 */
export function dismissedUserSnapshot(): string | null {
  return dismissedForUserId;
}
