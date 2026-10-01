import type { Session, SessionStatus } from '@/features/authentication';

import {
  PurchaseProviderFailure,
  type PurchaseAccessSnapshot,
  type PurchaseFailureReason,
  type PurchaseOutcome,
  type PurchasesPort,
  type SubscriptionOffer,
  type SubscriptionOfferHandle,
} from '../domain/purchases.port';
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
export type SubscriptionProviderOperation =
  'configure' | 'logIn' | 'restore' | 'access' | 'offer' | 'purchase' | 'manage';

/**
 * Provider-neutral failure. The raw SDK error is deliberately dropped (no
 * `cause`): its message or payload may carry keys, App User IDs or provider
 * detail that neither the UI nor logs may receive. `reason` is the adapter's
 * closed classification and is `unknown` for anything else.
 */
export class SubscriptionProviderError extends Error {
  constructor(
    readonly operation: SubscriptionProviderOperation,
    readonly reason: PurchaseFailureReason = 'unknown',
  ) {
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
  } catch (error) {
    const reason = error instanceof PurchaseProviderFailure ? error.reason : 'unknown';
    throw new SubscriptionProviderError(operation, reason);
  }
}

/**
 * Serializes the native SDK identity with the authenticated AppFitness owner.
 * SDK `logOut()` is intentionally forbidden: it creates an anonymous provider
 * identity. A -> B switches use `logIn(B)` directly; signed-out state exposes
 * no purchase operation until another authenticated UUID becomes current.
 *
 * Every user-facing operation (S-3) runs through `runForCurrentSession`: it is
 * queued behind identity alignment, re-checks the captured session after every
 * await, and discards a result that crosses sign-out, an account switch or a
 * session-generation change.
 */
export class SubscriptionPurchases {
  private desiredUserId: string | null = null;
  private providerUserId: string | null = null;
  private configured = false;
  private started = false;
  private unsubscribe: (() => void) | null = null;
  private tail: Promise<void> = Promise.resolve();
  /** Which account loaded each offer handle, so no handle outlives its owner. */
  private readonly offerOwners = new Map<SubscriptionOfferHandle, string>();

  constructor(
    private readonly purchases: PurchasesPort,
    private readonly config: SubscriptionProviderConfig,
    private readonly sessions: SubscriptionSessionSource,
    private readonly reportFailure: SubscriptionFailureReporter,
  ) {}

  /** True only for a native build with a valid platform public key. */
  get isAvailable(): boolean {
    return this.config.enabled && this.config.apiKey !== null;
  }

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

  restorePurchases(): Promise<PurchaseAccessSnapshot> {
    return this.runForCurrentSession('restore', () =>
      this.purchases.restorePurchases(this.config.entitlementId),
    );
  }

  getAccess(): Promise<PurchaseAccessSnapshot> {
    return this.runForCurrentSession('access', () =>
      this.purchases.getAccess(this.config.entitlementId),
    );
  }

  loadOffer(): Promise<SubscriptionOffer | null> {
    return this.runForCurrentSession('offer', () => this.purchases.loadMonthlyOffer(), {
      onResult: (offer, snapshot) => {
        this.offerOwners.clear();
        if (offer) this.offerOwners.set(offer.handle, snapshot.userId);
      },
    });
  }

  purchase(handle: SubscriptionOfferHandle): Promise<PurchaseOutcome> {
    return this.runForCurrentSession(
      'purchase',
      () => this.purchases.purchase(handle, this.config.entitlementId),
      {
        before: (snapshot) => {
          // An offer loaded by another account (or never loaded) is never bought.
          if (this.offerOwners.get(handle) !== snapshot.userId) {
            throw new SubscriptionSessionChangedError();
          }
        },
      },
    );
  }

  openManagement(): Promise<void> {
    return this.runForCurrentSession('manage', () => this.purchases.openManagement());
  }

  /** Allows deterministic shutdown/tests without exposing the SDK itself. */
  async waitForPendingWork(): Promise<void> {
    await this.tail;
  }

  private runForCurrentSession<T>(
    operation: SubscriptionProviderOperation,
    call: () => Promise<T>,
    hooks: {
      before?: (snapshot: SubscriptionSessionSnapshot) => void;
      onResult?: (result: T, snapshot: SubscriptionSessionSnapshot) => void;
    } = {},
  ): Promise<T> {
    if (!this.isAvailable) return Promise.reject(new SubscriptionUnavailableError());
    const snapshot = this.sessions.getSessionSnapshot();
    if (!snapshot || this.desiredUserId !== snapshot.userId) {
      return Promise.reject(new SubscriptionSessionChangedError());
    }

    return this.enqueue(async () => {
      this.assertCurrent(snapshot);
      await this.alignProvider(snapshot);
      this.assertCurrent(snapshot);
      hooks.before?.(snapshot);
      const result = await callProvider(operation, call);
      this.assertCurrent(snapshot);
      hooks.onResult?.(result, snapshot);
      return result;
    });
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
