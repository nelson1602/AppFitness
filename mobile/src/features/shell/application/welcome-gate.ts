import { useSyncExternalStore } from 'react';

import { getSession, getStatus, subscribe, type SessionStatus } from '@/features/authentication';

/**
 * The welcome screen's gate (ADR-P039 D5): it is owed once after a sign-in —
 * a move from signed-out to signed-in — and never on a session restored at
 * launch. It is held in memory for that one account only, so a restart, a
 * sign-out or a different account clears it. No persistence, no new table.
 */
let pendingFor: string | null = null;
let installed = false;
const listeners = new Set<() => void>();

function publish(next: string | null): void {
  if (next === pendingFor) return;
  pendingFor = next;
  listeners.forEach((listener) => listener());
}

/** Idempotent; called once from the composition root. */
export function initializeWelcomeGate(): void {
  if (installed) return;
  installed = true;
  let previous: SessionStatus = getStatus();
  subscribe((status, session) => {
    if (status !== 'authenticated' || !session) publish(null);
    else if (previous === 'unauthenticated') publish(session.user.id);
    else if (pendingFor !== null && pendingFor !== session.user.id) publish(null);
    previous = status;
  });
}

export function markWelcomeSeen(): void {
  publish(null);
}

function snapshot(): boolean {
  return pendingFor !== null && pendingFor === getSession()?.user.id;
}

/** Whether the signed-in account is owed the welcome screen. */
export function useWelcomePending(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    snapshot,
    snapshot,
  );
}
