import type { KeyRead } from './biometric-vault';

export type { KeyRead } from './biometric-vault';

/**
 * Web: no biometric vault (ADR-P036 Decision 1, ADR-P018 — Web sessions are
 * memory-only). Nothing is ever linked, so every read reports absence.
 */
export function createUnlockKey(): Promise<Uint8Array | null> {
  return Promise.resolve(null);
}

export function readUnlockKey(): Promise<KeyRead> {
  return Promise.resolve({ status: 'invalidated' });
}

export function deleteUnlockKey(): Promise<void> {
  return Promise.resolve();
}

export function readLinkedUserId(): Promise<string | null> {
  return Promise.resolve(null);
}

export function writeLink(): Promise<void> {
  return Promise.resolve();
}

export function deleteLink(): Promise<void> {
  return Promise.resolve();
}
