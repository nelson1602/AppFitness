export const SUBSCRIPTION_ENTITLEMENT_ID = 'appfitness_pro';

export type NativePurchasePlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos' | 'other';

export interface SubscriptionProviderConfig {
  readonly enabled: boolean;
  readonly apiKey: string | null;
  readonly entitlementId: typeof SUBSCRIPTION_ENTITLEMENT_ID;
}

interface PublicPurchaseEnvironment {
  readonly EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?: string;
  readonly EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?: string;
}

const KEY_BY_PLATFORM = {
  ios: {
    environmentKey: 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    prefix: 'appl_',
  },
  android: {
    environmentKey: 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
    prefix: 'goog_',
  },
} as const;

/** Resolves public SDK keys without ever falling back across platforms. */
export function resolveSubscriptionProviderConfig(
  platform: NativePurchasePlatform,
  environment: PublicPurchaseEnvironment = {
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  },
): SubscriptionProviderConfig {
  if (platform !== 'ios' && platform !== 'android') {
    return { enabled: false, apiKey: null, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID };
  }

  const rule = KEY_BY_PLATFORM[platform];
  const candidate = environment[rule.environmentKey]?.trim();
  if (!candidate) {
    return { enabled: false, apiKey: null, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID };
  }
  if (!candidate.startsWith(rule.prefix)) {
    throw new Error(`Invalid public RevenueCat key for ${platform}`);
  }

  return { enabled: true, apiKey: candidate, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID };
}
