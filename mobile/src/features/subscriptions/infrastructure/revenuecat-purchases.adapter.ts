import type {
  ConfigurePurchasesInput,
  PurchaseAccessSnapshot,
  PurchasesPort,
} from '../domain/purchases.port';

type RevenueCatModule = typeof import('react-native-purchases');
type RevenueCatClient = typeof import('react-native-purchases').default;

export type RevenueCatLoader = () => Promise<RevenueCatModule>;

/* istanbul ignore next -- Jest cannot execute native dynamic imports; the source guard verifies it. */
const loadRevenueCat: RevenueCatLoader = () => import('react-native-purchases');

/**
 * The only file allowed to know the RevenueCat SDK. Loading stays lazy so Web,
 * Expo Go and native builds without public keys never execute the native module.
 */
export class RevenueCatPurchasesAdapter implements PurchasesPort {
  private purchases: RevenueCatClient | null = null;

  constructor(private readonly load: RevenueCatLoader = loadRevenueCat) {}

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

  async restorePurchases(entitlementId: string): Promise<PurchaseAccessSnapshot> {
    const purchases = await this.getPurchases();
    const customerInfo = await purchases.restorePurchases();
    const entitlement = customerInfo.entitlements.active[entitlementId];

    return {
      isActive: entitlement?.isActive === true,
      expiresAt: entitlement?.expirationDate ?? null,
      productId: entitlement?.productIdentifier ?? null,
      willRenew: entitlement?.willRenew === true,
    };
  }

  private async getPurchases(): Promise<RevenueCatClient> {
    const purchases = this.purchases ?? (await this.load()).default;
    this.purchases = purchases;
    return purchases;
  }
}
