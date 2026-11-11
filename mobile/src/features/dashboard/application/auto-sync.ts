/**
 * BUG-049: automatic sync. Before it, `runSync` ran only from the evaluation
 * gate and the "Sincronizar ahora" buttons, so local writes waited in the
 * queue until the person tapped one (PR #253 review: 20 pending ops with the
 * API up).
 *
 * When it runs (only while the app is in the foreground and signed in):
 * - **start**: once when the signed-in shell mounts;
 * - **foreground**: each time the app comes back to the foreground;
 * - **save**: after a local write, debounced, so a burst of taps is one run;
 * - **retry**: while ops stay pending after an offline or server-error run,
 *   every `retryMs`, so the queue drains once the network is back. There is
 *   no connectivity listener: none is in the approved stack (no ADR), so a
 *   foreground retry stands in for "network regained".
 *
 * A session or subscription problem is not retried: it needs the person.
 * `runSync` itself shares one standing run per user (BUG-030), so a manual tap
 * during an automatic run never pushes twice.
 */

import { logError } from '@/shared/infrastructure/logging';

export type AutoSyncTrigger = 'start' | 'foreground' | 'save';

export interface AutoSyncResult {
  outcome: 'success' | 'offline' | 'error' | 'blocked';
  /** Ops still PENDING or FAILED after the run. */
  pending: number;
}

export interface AutoSyncTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface AutoSyncDeps {
  sync: () => Promise<AutoSyncResult>;
  timers?: AutoSyncTimers;
  saveDebounceMs?: number;
  retryMs?: number;
}

export interface AutoSync {
  request: (trigger: AutoSyncTrigger) => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export const AUTO_SYNC_SAVE_DEBOUNCE_MS = 2_000;
export const AUTO_SYNC_RETRY_MS = 30_000;

const realTimers: AutoSyncTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createAutoSync({
  sync,
  timers = realTimers,
  saveDebounceMs = AUTO_SYNC_SAVE_DEBOUNCE_MS,
  retryMs = AUTO_SYNC_RETRY_MS,
}: AutoSyncDeps): AutoSync {
  let active = true;
  let disposed = false;
  let running = false;
  /** A write landed while a run was going: run once more after it. */
  let again = false;
  let timer: unknown = null;

  const cancel = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  const schedule = (ms: number) => {
    cancel();
    timer = timers.set(() => {
      timer = null;
      void execute();
    }, ms);
  };

  async function execute(): Promise<void> {
    if (disposed || !active) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    again = false;
    let result: AutoSyncResult;
    try {
      result = await sync();
    } catch (error) {
      // Retryable: the next foreground retry tries again.
      logError('dashboard.autoSync', error);
      result = { outcome: 'error', pending: 1 };
    } finally {
      running = false;
    }
    if (disposed || !active) return;
    if (again && result.outcome === 'success') {
      schedule(saveDebounceMs);
    } else if (result.pending > 0 && (result.outcome === 'offline' || result.outcome === 'error')) {
      schedule(retryMs);
    }
  }

  return {
    request: (trigger) => {
      if (disposed || !active) return;
      if (trigger === 'save') {
        if (running) {
          again = true;
          return;
        }
        schedule(saveDebounceMs);
        return;
      }
      schedule(0);
    },
    setActive: (next) => {
      if (disposed || next === active) return;
      active = next;
      if (!next) {
        cancel();
        return;
      }
      schedule(0);
    },
    dispose: () => {
      disposed = true;
      cancel();
    },
  };
}
