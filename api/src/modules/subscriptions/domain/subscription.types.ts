export const ENTITLEMENT_PROVIDER = Symbol('ENTITLEMENT_PROVIDER');

export interface ProviderEntitlementSnapshot {
  entitlementId: string;
  isActive: boolean;
  expiresAt: Date | null;
  periodType: string | null;
  productId: string | null;
  store: string | null;
  environment: string | null;
  willRenew: boolean | null;
}

/**
 * RevenueCat promotional durations the backoffice may grant (ADR-P049
 * amendment 1). A subset of the provider's list, from a week to lifetime.
 */
export const PROMOTIONAL_DURATIONS = [
  'weekly',
  'monthly',
  'three_month',
  'six_month',
  'yearly',
  'lifetime',
] as const;
export type PromotionalDuration = (typeof PROMOTIONAL_DURATIONS)[number];

export interface EntitlementProvider {
  readonly enabled: boolean;
  getEntitlement(userId: string): Promise<ProviderEntitlementSnapshot>;
  ensureCustomerDeleted(userId: string): Promise<void>;
  /** Grants the paid entitlement as a RevenueCat promotional (staff only). */
  grantPromotional(
    userId: string,
    duration: PromotionalDuration,
  ): Promise<void>;
  /** Revokes every promotional of the paid entitlement (staff only). */
  revokePromotionals(userId: string): Promise<void>;
}

export class SubscriptionProviderUnavailableError extends Error {
  constructor() {
    super('Subscription provider is unavailable');
    this.name = 'SubscriptionProviderUnavailableError';
  }
}

export interface SubscriptionStatusView {
  state: 'UNKNOWN' | 'ACTIVE' | 'INACTIVE';
  expiresAt: string | null;
  periodType: string | null;
  store: string | null;
  willRenew: boolean | null;
  lastReconciledAt: string | null;
}

export interface ParsedRevenueCatEvent {
  id: string;
  type: string;
  isTransfer: boolean;
  transferDestinationUserIds: string[];
  timestamp: Date;
  environment: string | null;
  candidateUserIds: string[];
}

export interface WebhookIngestionResult {
  accepted: true;
  duplicate: boolean;
  outcome: 'PROCESSED' | 'IGNORED';
}
