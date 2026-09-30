export interface PurchaseAccessSnapshot {
  readonly isActive: boolean;
  readonly expiresAt: string | null;
  readonly productId: string | null;
  readonly willRenew: boolean;
}

export interface ConfigurePurchasesInput {
  readonly apiKey: string;
  readonly appUserId: string;
  readonly entitlementId: string;
}

export type SubscriptionPeriodUnit = 'day' | 'week' | 'month' | 'year';

/** A store-reported length of time, e.g. `{ unit: 'month', count: 1 }`. */
export interface SubscriptionDuration {
  readonly unit: SubscriptionPeriodUnit;
  readonly count: number;
}

declare const offerHandleBrand: unique symbol;

/**
 * Opaque reference to the exact store package returned by the latest offer
 * load. Only the adapter that issued it can resolve it; presentation never sees
 * the provider package and can never reconstruct one.
 */
export type SubscriptionOfferHandle = string & { readonly [offerHandleBrand]: true };

/**
 * The one monthly offer, normalized from store evidence (ADR-P034 Decisions 3
 * and 10). Every price string is store-localized and rendered verbatim.
 * `freeTrial` is non-null **only** when the store evidence says this user is
 * eligible for a free introductory period; unknown eligibility is `null`, so the
 * UI falls back to ordinary paid terms and never promises a trial.
 */
export interface SubscriptionOffer {
  readonly handle: SubscriptionOfferHandle;
  readonly productId: string;
  readonly price: string;
  readonly billingPeriod: SubscriptionDuration;
  readonly freeTrial: SubscriptionDuration | null;
}

export type PurchaseOutcome =
  | { readonly kind: 'completed'; readonly access: PurchaseAccessSnapshot }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'pending' };

/** Allow-listed, non-sensitive reason a provider call failed. */
export type PurchaseFailureReason = 'network' | 'notAllowed' | 'unknown';

/**
 * The only failure shape an adapter may raise. It carries a closed reason and a
 * fixed message, never the provider's own message, code text or payload.
 */
export class PurchaseProviderFailure extends Error {
  constructor(readonly reason: PurchaseFailureReason) {
    super('The purchase provider reported a failure');
    this.name = 'PurchaseProviderFailure';
  }
}

/**
 * Provider-neutral native purchase boundary (ADR-P034, slices S-2 and S-3).
 *
 * The application supplies only the authenticated account UUID. Email,
 * username and product-domain data do not belong on this boundary, and no
 * provider type crosses it.
 */
export interface PurchasesPort {
  configure(input: ConfigurePurchasesInput): Promise<void>;
  logIn(appUserId: string): Promise<void>;
  restorePurchases(entitlementId: string): Promise<PurchaseAccessSnapshot>;
  getAccess(entitlementId: string): Promise<PurchaseAccessSnapshot>;
  /** The current offering's monthly package, or `null` when none is offered. */
  loadMonthlyOffer(): Promise<SubscriptionOffer | null>;
  purchase(handle: SubscriptionOfferHandle, entitlementId: string): Promise<PurchaseOutcome>;
  openManagement(): Promise<void>;
}
