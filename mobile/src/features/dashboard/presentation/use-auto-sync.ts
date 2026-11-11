import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { onEnqueued } from '@/shared/infrastructure/sync';

import { createAutoSync } from '../application/auto-sync';
import { runAutoSync } from '../application/auto-sync-runner';

/**
 * BUG-049: mounted by the signed-in tab shell. Syncs on start, on return to
 * the foreground, after each local save (debounced) and, while ops stay
 * pending after an offline run, on a foreground retry. Web has no local
 * database (ADR-P019), so there is nothing to drain there.
 */
export function useAutoSync(userId: string | null): void {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return undefined;
    const auto = createAutoSync({ sync: runAutoSync });
    const stopSaves = onEnqueued((owner) => {
      if (owner === userId) auto.request('save');
    });
    const appState = AppState.addEventListener('change', (state) => {
      auto.setActive(state === 'active');
    });
    if (AppState.currentState === 'active') auto.request('start');
    else auto.setActive(false);
    return () => {
      stopSaves();
      appState.remove();
      auto.dispose();
    };
  }, [userId]);
}
