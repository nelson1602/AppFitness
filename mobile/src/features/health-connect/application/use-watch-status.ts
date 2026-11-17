import { useEffect } from 'react';

import { getSession } from '@/features/authentication';
import { useLocalDay } from '@/shared/application/local-day';

import { useHealthConnectStore, type WatchStatus } from './health-connect.store';

/**
 * The watch's status for this account, refreshed on mount and when the day
 * changes (ADR-P048). Null until known, and for another account's data.
 */
export function useWatchStatus(): WatchStatus | null {
  const today = useLocalDay((s) => s.today);
  const userId = getSession()?.user.id ?? null;
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
