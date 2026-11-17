import { useEffect } from 'react';

import { useSession } from '@/features/authentication';
import { useLocalDay } from '@/shared/application/local-day';

import { useHealthConnectStore, type WatchStatus } from './health-connect.store';

/**
 * The watch's status for this account, refreshed on mount, when the account
 * is known and when the day changes (ADR-P048). Null until known, and for
 * another account's data.
 *
 * The account comes from `useSession()`, never a plain `getSession()` call in
 * render: the React Compiler memoizes such a call, so on a screen opened
 * before the session restored (Health Connect opening the rationale screen on
 * a cold start) it stayed null and nothing was ever read (emulator,
 * 2026-11-17).
 */
export function useWatchStatus(): WatchStatus | null {
  const today = useLocalDay((s) => s.today);
  const userId = useSession().session?.user.id ?? null;
  const status = useHealthConnectStore((s) => s.status);
  const owner = useHealthConnectStore((s) => s.userId);

  useEffect(() => {
    if (userId !== null) void useHealthConnectStore.getState().refresh(today);
  }, [today, userId]);

  return owner === userId ? status : null;
}

/** The statuses that show the watch UI instead of the old "Próximamente". */
export function showsWatch(status: WatchStatus | null): boolean {
  return status === 'connected' || status === 'not-connected' || status === 'needs-update';
}
