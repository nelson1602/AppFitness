import { logError } from '../logging/logger';

/**
 * BUG-049: a local write tells whoever listens that the queue gained (or
 * folded) an op, so automatic sync can push it without the person tapping
 * "Sincronizar ahora". The event fires when `enqueue` returns, which can be
 * inside the caller's transaction: listeners must debounce, never read the
 * queue synchronously.
 */
type EnqueueListener = (userId: string) => void;

const listeners = new Set<EnqueueListener>();

export function onEnqueued(listener: EnqueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyEnqueued(userId: string): void {
  for (const listener of [...listeners]) {
    try {
      listener(userId);
    } catch (error) {
      // A listener's failure must never fail the write that enqueued.
      logError('sync.onEnqueued', error);
    }
  }
}
