import { useEffect, useSyncExternalStore } from 'react';

// Import concrete modules, not the feature barrel ('..') — the barrel
// re-exports this hook, which creates a require cycle.
import {
  getSession,
  getStatus,
  restoreSession,
  subscribe,
} from '../application/session-manager';
import type { Session, SessionStatus } from '../domain/session.types';

interface SessionSnapshot {
  status: SessionStatus;
  session: Session | null;
}

// useSyncExternalStore compares snapshots with Object.is, so the same
// store state must yield the same object reference — a fresh literal per
// call re-renders forever ("maximum update depth exceeded").
let cachedSnapshot: SessionSnapshot | null = null;

// Exported for regression tests only — production code uses useSession().
export function snapshot(): SessionSnapshot {
  const status = getStatus();
  const session = getSession();
  if (!cachedSnapshot || cachedSnapshot.status !== status || cachedSnapshot.session !== session) {
    cachedSnapshot = { status, session };
  }
  return cachedSnapshot;
}

export function useSession(): SessionSnapshot {
  const current = useSyncExternalStore(
    (onStoreChange) => subscribe(onStoreChange),
    snapshot,
    snapshot,
  );

  useEffect(() => {
    if (current.status === 'unknown') void restoreSession();
  }, [current.status]);

  return current;
}

