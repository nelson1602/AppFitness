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

/**
 * Provider-neutral native purchase boundary (ADR-P034, slice S-2).
 *
 * The application supplies only the authenticated account UUID. Email,
 * username and product-domain data do not belong on this boundary.
 */
export interface PurchasesPort {
  configure(input: ConfigurePurchasesInput): Promise<void>;
  logIn(appUserId: string): Promise<void>;
  restorePurchases(entitlementId: string): Promise<PurchaseAccessSnapshot>;
}
