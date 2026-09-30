import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreProduct,
  SubscriptionOption,
} from 'react-native-purchases';

import {
  PurchaseProviderFailure,
  type ConfigurePurchasesInput,
  type PurchaseAccessSnapshot,
  type PurchaseFailureReason,
  type PurchaseOutcome,
  type PurchasesPort,
  type SubscriptionDuration,
  type SubscriptionOffer,
  type SubscriptionOfferHandle,
  type SubscriptionPeriodUnit,
} from '../domain/purchases.port';

type RevenueCatModule = typeof import('react-native-purchases');
type RevenueCatClient = typeof import('react-native-purchases').default;

export type RevenueCatLoader = () => Promise<RevenueCatModule>;
export type ManagementPlatform = 'ios' | 'android';
export type ExternalUrlOpener = (url: string) => Promise<void>;

/* istanbul ignore next -- Jest cannot execute native dynamic imports; the source guard verifies it. */
const loadRevenueCat: RevenueCatLoader = () => import('react-native-purchases');

/** The one billing period ADR-P034 Decision 3 sells. Anything else is refused. */
const MONTHLY_ISO_PERIOD = 'P1M';

const ISO_UNIT: Record<string, SubscriptionPeriodUnit> = {
  D: 'day',
  W: 'week',
  M: 'month',
  Y: 'year',
};

const SDK_UNIT: Record<string, SubscriptionPeriodUnit> = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
};

/** `P1M` → one month. Composite or unknown periods are not representable. */
function parseIsoPeriod(value: string | null | undefined): SubscriptionDuration | null {
  const match = /^P(\d+)([DWMY])$/.exec(value ?? '');
  if (!match) return null;
  const count = Number(match[1]);
  const unit = ISO_UNIT[match[2]];
  return count > 0 && unit ? { unit, count } : null;
}

function multiply(duration: SubscriptionDuration | null, cycles: number | null | undefined) {
  if (!duration) return null;
  const times = cycles ?? 1;
  return times > 0 ? { unit: duration.unit, count: duration.count * times } : null;
}

/**
 * The only file allowed to know the RevenueCat SDK. Loading stays lazy so Web,
 * Expo Go and native builds without public keys never execute the native module.
 * Provider types stop here: every method returns AppFitness-owned models, and
 * every S-3 failure — including a failure to load the module — is re-raised as
 * a closed `PurchaseProviderFailure`. (S-2 identity calls are sanitized by the
 * application boundary.)
 */
export class RevenueCatPurchasesAdapter implements PurchasesPort {
  private purchases: RevenueCatClient | null = null;
  private issuedHandle: SubscriptionOfferHandle | null = null;
  private issuedPackage: PurchasesPackage | null = null;
  private handleSequence = 0;

  constructor(
    private readonly load: RevenueCatLoader = loadRevenueCat,
    private readonly platform: ManagementPlatform = 'ios',
    private readonly openUrl: ExternalUrlOpener = async () => {
      throw new PurchaseProviderFailure('unknown');
    },
  ) {}

  async configure(input: ConfigurePurchasesInput): Promise<void> {
    const purchases = await this.getPurchases();
    if (await purchases.isConfigured()) {
      const currentUserId = await purchases.getAppUserID();
      if (currentUserId !== input.appUserId) await purchases.logIn(input.appUserId);
      return;
    }

    purchases.configure({ apiKey: input.apiKey, appUserID: input.appUserId });
  }

  async logIn(appUserId: string): Promise<void> {
    const purchases = await this.getPurchases();
    await purchases.logIn(appUserId);
  }

  restorePurchases(entitlementId: string): Promise<PurchaseAccessSnapshot> {
    return this.provider(async (purchases) =>
      toAccess(await purchases.restorePurchases(), entitlementId),
    );
  }

  getAccess(entitlementId: string): Promise<PurchaseAccessSnapshot> {
    return this.provider(async (purchases) =>
      toAccess(await purchases.getCustomerInfo(), entitlementId),
    );
  }

  loadMonthlyOffer(): Promise<SubscriptionOffer | null> {
    return this.provider(async (purchases) => {
      // A new load always invalidates the previous handle, so a purchase can
      // only ever target the package this exact load returned.
      this.issuedHandle = null;
      this.issuedPackage = null;

      const offerings = await purchases.getOfferings();
      const monthly = offerings.current?.monthly ?? null;
      if (!monthly) return null;

      const product = monthly.product;
      const billingPeriod = parseIsoPeriod(product.subscriptionPeriod);
      if (product.subscriptionPeriod !== MONTHLY_ISO_PERIOD || !billingPeriod) return null;

      const google = product.defaultOption;
      const price = google ? google.fullPricePhase?.price.formatted : product.priceString;
      if (!price) return null;

      const freeTrial = google
        ? googleFreeTrial(google)
        : await this.appleFreeTrial(purchases, product);

      this.handleSequence += 1;
      const handle = `offer-${this.handleSequence}` as SubscriptionOfferHandle;
      this.issuedHandle = handle;
      this.issuedPackage = monthly;
      return { handle, productId: product.identifier, price, billingPeriod, freeTrial };
    });
  }

  purchase(handle: SubscriptionOfferHandle, entitlementId: string): Promise<PurchaseOutcome> {
    return this.provider(async (purchases) => {
      const pkg = handle === this.issuedHandle ? this.issuedPackage : null;
      if (!pkg) throw new PurchaseProviderFailure('unknown');

      try {
        const result = await purchases.purchasePackage(pkg);
        return { kind: 'completed', access: toAccess(result.customerInfo, entitlementId) };
      } catch (error) {
        // Cancellation and a pending payment are outcomes, not failures.
        const code = errorCode(error);
        const codes = purchases.PURCHASES_ERROR_CODE;
        if (code === codes.PURCHASE_CANCELLED_ERROR || isUserCancel(error)) {
          return { kind: 'cancelled' };
        }
        if (code === codes.PAYMENT_PENDING_ERROR) return { kind: 'pending' };
        throw error;
      }
    });
  }

  openManagement(): Promise<void> {
    return this.provider(async (purchases) => {
      if (this.platform === 'ios') {
        await purchases.showManageSubscriptions();
        return;
      }
      // `showManageSubscriptions()` is iOS-only; Google Play management is the
      // provider-reported URL. Only a secure web URL is ever opened.
      const { managementURL } = await purchases.getCustomerInfo();
      if (!managementURL?.startsWith('https://')) throw new PurchaseProviderFailure('unknown');
      await this.openUrl(managementURL);
    });
  }

  /**
   * iOS: the SDK's eligibility check is the only trial evidence. Unknown,
   * ineligible, a failed check or a paid (non-free) introductory price all
   * resolve to `null`: the SDK documents that unknown must show normal pricing.
   */
  private async appleFreeTrial(
    purchases: RevenueCatClient,
    product: PurchasesStoreProduct,
  ): Promise<SubscriptionDuration | null> {
    const intro = product.introPrice;
    if (!intro || intro.price !== 0) return null;

    let eligible = false;
    try {
      const eligibility = await purchases.checkTrialOrIntroductoryPriceEligibility([
        product.identifier,
      ]);
      eligible =
        eligibility[product.identifier]?.status ===
        purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    } catch {
      eligible = false;
    }
    if (!eligible) return null;

    const unit = SDK_UNIT[intro.periodUnit];
    const base = unit ? { unit, count: intro.periodNumberOfUnits } : null;
    return base && base.count > 0 ? multiply(base, intro.cycles) : null;
  }

  /** Loads the SDK and runs one call; any failure leaves as a closed reason. */
  private async provider<T>(call: (purchases: RevenueCatClient) => Promise<T>): Promise<T> {
    try {
      return await call(await this.getPurchases());
    } catch (error) {
      if (error instanceof PurchaseProviderFailure) throw error;
      const purchases = this.purchases;
      throw new PurchaseProviderFailure(
        purchases ? classify(purchases, errorCode(error)) : 'unknown',
      );
    }
  }

  private async getPurchases(): Promise<RevenueCatClient> {
    const purchases = this.purchases ?? (await this.load()).default;
    this.purchases = purchases;
    return purchases;
  }
}

/**
 * Google Play: the default option is the one `purchasePackage` buys, and Play
 * lists only the offers this user can redeem. A free phase on that option is
 * therefore the trial the user will actually receive; without one, paid terms.
 *
 * The trial length is shown only when the phase proves it: a recognized unit,
 * a positive-integer period value and a positive-integer cycle count. The SDK
 * types `billingCycleCount` as `number | null`, and null is not evidence of any
 * particular length, so it — like zero, negative or fractional values — yields
 * no trial rather than an assumed single cycle.
 */
function googleFreeTrial(option: SubscriptionOption): SubscriptionDuration | null {
  const phase = option.freePhase;
  if (!phase) return null;
  const unit = SDK_UNIT[phase.billingPeriod.unit];
  const value = phase.billingPeriod.value;
  const cycles = phase.billingCycleCount;
  if (!unit || !isPositiveInteger(value) || !isPositiveInteger(cycles)) return null;
  return { unit, count: value * cycles };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function toAccess(customerInfo: CustomerInfo, entitlementId: string): PurchaseAccessSnapshot {
  const entitlement = customerInfo.entitlements.active[entitlementId];
  return {
    isActive: entitlement?.isActive === true,
    expiresAt: entitlement?.expirationDate ?? null,
    productId: entitlement?.productIdentifier ?? null,
    willRenew: entitlement?.willRenew === true,
  };
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

function isUserCancel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'userCancelled' in error
    ? error.userCancelled === true
    : false;
}

function classify(purchases: RevenueCatClient, code: string | null): PurchaseFailureReason {
  const codes = purchases.PURCHASES_ERROR_CODE;
  if (
    code === codes.NETWORK_ERROR ||
    code === codes.OFFLINE_CONNECTION_ERROR ||
    code === codes.PRODUCT_REQUEST_TIMED_OUT_ERROR
  ) {
    return 'network';
  }
  if (code === codes.PURCHASE_NOT_ALLOWED_ERROR) return 'notAllowed';
  return 'unknown';
}
