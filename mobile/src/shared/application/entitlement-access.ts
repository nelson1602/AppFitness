/**
 * Process-local projection of the provider-controlled entitlement (ADR-P034
 * S-4). The subscription feature is the only publisher; repositories and sync
 * consume this boundary without importing a provider SDK or feature store.
 */
export type EntitlementAccessMode = 'unregulated' | 'checking' | 'active' | 'read-only';

export interface EntitlementAccessSnapshot {
  readonly mode: EntitlementAccessMode;
  readonly userId: string | null;
}

export class EntitlementRequiredError extends Error {
  constructor() {
    super('An active subscription is required for this operation');
    this.name = 'EntitlementRequiredError';
  }
}

let snapshot: EntitlementAccessSnapshot = { mode: 'unregulated', userId: null };
const listeners = new Set<() => void>();

function publish(next: EntitlementAccessSnapshot): void {
  if (next.mode === snapshot.mode && next.userId === snapshot.userId) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Disabled builds keep the pre-subscription product behaviour unchanged. */
export function configureEntitlementEnforcement(enabled: boolean): void {
  publish(enabled ? { mode: 'checking', userId: null } : { mode: 'unregulated', userId: null });
}

/** Called synchronously before provider access is read for this account. */
export function beginEntitlementCheck(userId: string): void {
  if (snapshot.mode === 'unregulated') return;
  publish({ mode: 'checking', userId });
}

/** Publishes only provider evidence already protected by session-generation checks. */
export function setEntitlementAccess(userId: string, active: boolean): void {
  if (snapshot.mode === 'unregulated') return;
  publish({ mode: active ? 'active' : 'read-only', userId });
}

/** Account transitions fail closed until the new owner's provider read finishes. */
export function resetEntitlementAccess(): void {
  if (snapshot.mode === 'unregulated') return;
  publish({ mode: 'checking', userId: null });
}

export function getEntitlementAccess(): EntitlementAccessSnapshot {
  return snapshot;
}

export function subscribeEntitlementAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasPaidMutationAccess(userId: string): boolean {
  return (
    snapshot.mode === 'unregulated' || (snapshot.mode === 'active' && snapshot.userId === userId)
  );
}

export function assertPaidMutationAccess(userId: string): void {
  if (!hasPaidMutationAccess(userId)) throw new EntitlementRequiredError();
}
