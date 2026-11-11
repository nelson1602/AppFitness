import { useFoodLogStore } from '@/features/nutrition/application/food-log.store';

import type { AutoSyncResult } from './auto-sync';
import { useDashboardStore } from './dashboard.store';

/**
 * BUG-049: one automatic sync, through the same entry points as
 * "Sincronizar ahora", so Perfil's pending count and the food log's sync
 * state refresh with it. Both stores call `runSync` in the same tick, so they
 * share one standing run (BUG-030) instead of pushing twice.
 */
export async function runAutoSync(): Promise<AutoSyncResult> {
  const foodLog = useFoodLogStore.getState();
  await Promise.all([
    useDashboardStore.getState().syncNow(),
    foodLog.status === 'ready' ? foodLog.syncNow() : Promise.resolve(),
  ]);
  const sync = useDashboardStore.getState().data?.sync;
  if (!sync) return { outcome: 'error', pending: 1 };
  const pending = sync.pending + sync.failed;
  if (sync.problem === 'session' || sync.problem === 'subscription') {
    return { outcome: 'blocked', pending };
  }
  const outcome =
    sync.status === 'offline' ? 'offline' : sync.status === 'error' ? 'error' : 'success';
  return { outcome, pending };
}
