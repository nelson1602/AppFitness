import { useEffect, useMemo } from 'react';

import { getSession } from '@/features/authentication';

import type { AppWorkoutWindow, WatchSession } from '../domain/watch-activity';
import { useHealthConnectStore } from './health-connect.store';

export interface WatchSessions {
  sessions: WatchSession[];
  appWorkouts: AppWorkoutWindow[];
}

/**
 * The watch's exercise sessions and the app's workout windows, for the
 * carry-over (ADR-P048, C9), read on open and when the day changes. Null
 * whenever the flag is off, Health Connect is missing or not connected, or the
 * data belongs to another account — the carry-over is then `carry-over@1.0.0`'s.
 * The caller turns them into kcal with `watchExercise` and its own weight.
 */
export function useWatchSessions(today: string): WatchSessions | null {
  const userId = getSession()?.user.id ?? null;
  const status = useHealthConnectStore((s) => s.status);
  const owner = useHealthConnectStore((s) => s.userId);
  const sessions = useHealthConnectStore((s) => s.sessions);
  const appWorkouts = useHealthConnectStore((s) => s.appWorkouts);

  useEffect(() => {
    if (userId !== null) void useHealthConnectStore.getState().refresh(today);
  }, [today, userId]);

  return useMemo(
    () =>
      status === 'connected' && owner === userId && sessions.length > 0
        ? { sessions, appWorkouts }
        : null,
    [appWorkouts, owner, sessions, status, userId],
  );
}
