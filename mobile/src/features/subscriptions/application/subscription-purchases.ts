import type { Session, SessionStatus } from '@/features/authentication';

import type { PurchaseAccessSnapshot, PurchasesPort } from '../domain/purchases.port';
import type { SubscriptionProviderConfig } from '../infrastructure/revenuecat-config';

export interface SubscriptionSessionSnapshot {
  readonly userId: string;
}

export interface SubscriptionSessionSource {
  getSessionSnapshot(): SubscriptionSessionSnapshot | null;
  isSessionCurrent(snapshot: SubscriptionSessionSnapshot): boolean;
  subscribe(listener: (status: SessionStatus, session: Session | null) => void): () => void;
}

export type SubscriptionFailureReporter = (scope: string, error: unknown) => void;

export class SubscriptionUnavailableError extends Error {
  constructor() {
    super('Subscriptions are unavailable in this build');
    this.name = 'SubscriptionUnavailableError';
  }
}

export class SubscriptionSessionChangedError extends Error {
  constructor() {
    super('The authenticated account changed during the purchase operation');
    this.name = 'SubscriptionSessionChangedError';
  }
}

/** Allow-listed, non-sensitive classification of the failed provider call. */
export type SubscriptionProviderOperation = 'configure' | 'logIn' | 'restore';

/**
 * Provider-neutral failure. The raw SDK error is deliberately dropped (no
 * `cause`): its message or payload may carry keys, App User IDs or provider
 * detail that neither the UI nor logs may receive.
 */
export class SubscriptionProviderError extends Error {
  constructor(readonly operation: SubscriptionProviderOperation) {
    super('The subscription provider could not complete the request');
    this.name = 'SubscriptionProviderError';
  }
}

async function callProvider<T>(
  operation: SubscriptionProviderOperation,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch {
    throw new SubscriptionProviderError(operation);
  }
}

/**
 * Serializes the native SDK identity with the authenticated AppFitness owner.
 * SDK `logOut()` is intentionally forbidden: it creates an anonymous provider
 * identity. A -> B switches use `logIn(B)` directly; signed-out state exposes
 * no purchase operation until another authenticated UUID becomes current.
 */
export class SubscriptionPurchases {
  private desiredUserId: string | null = null;
  private providerUserId: string | null = null;
  private configured = false;
  private started = false;
  private unsubscribe: (() => void) | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly purchases: PurchasesPort,
    private readonly config: SubscriptionProviderConfig,
    private readonly sessions: SubscriptionSessionSource,
    private readonly reportFailure: SubscriptionFailureReporter,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribe = this.sessions.subscribe((_status, session) => {
      this.desiredUserId = session?.user.id ?? null;
      const snapshot = this.sessions.getSessionSnapshot();
      if (!snapshot) return;
      void this.enqueue(() => this.alignProvider(snapshot)).catch((error: unknown) => {
        this.reportFailure('subscriptions.identity', error);
      });
    });

    const snapshot = this.sessions.getSessionSnapshot();
    this.desiredUserId = snapshot?.userId ?? null;
    if (snapshot) {
      void this.enqueue(() => this.alignProvider(snapshot)).catch((error: unknown) => {
        this.reportFailure('subscriptions.identity', error);
      });
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.started = false;
    this.desiredUserId = null;
  }

  async restorePurchases(): Promise<PurchaseAccessSnapshot> {
    if (!this.config.enabled || !this.config.apiKey) throw new SubscriptionUnavailableError();
    const snapshot = this.sessions.getSessionSnapshot();
    if (!snapshot || this.desiredUserId !== snapshot.userId) {
      throw new SubscriptionSessionChangedError();
    }

    return this.enqueue(async () => {
      this.assertCurrent(snapshot);
      await this.alignProvider(snapshot);
      this.assertCurrent(snapshot);
      const access = await callProvider('restore', () =>
        this.purchases.restorePurchases(this.config.entitlementId),
      );
      this.assertCurrent(snapshot);
      return access;
    });
  }

  /** Allows deterministic shutdown/tests without exposing the SDK itself. */
  async waitForPendingWork(): Promise<void> {
    await this.tail;
  }

  private async alignProvider(snapshot: SubscriptionSessionSnapshot): Promise<void> {
    if (!this.config.enabled || !this.config.apiKey) return;
    if (!this.isCurrent(snapshot)) return;

    if (!this.configured) {
      const apiKey = this.config.apiKey;
      await callProvider('configure', () =>
        this.purchases.configure({
          apiKey,
          appUserId: snapshot.userId,
          entitlementId: this.config.entitlementId,
        }),
      );
      this.configured = true;
      this.providerUserId = snapshot.userId;
      return;
    }

    if (this.providerUserId !== snapshot.userId) {
      await callProvider('logIn', () => this.purchases.logIn(snapshot.userId));
      this.providerUserId = snapshot.userId;
    }
  }

  private assertCurrent(snapshot: SubscriptionSessionSnapshot): void {
    if (!this.isCurrent(snapshot)) throw new SubscriptionSessionChangedError();
  }

  private isCurrent(snapshot: SubscriptionSessionSnapshot): boolean {
    return this.desiredUserId === snapshot.userId && this.sessions.isSessionCurrent(snapshot);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
