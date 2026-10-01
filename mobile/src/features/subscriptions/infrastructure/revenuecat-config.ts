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
  readonly EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?: string;
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

/**
 * RevenueCat Test Store public keys start with `test_` (the installed RevenueCat
 * React Native SDK browser native module; the native iOS and Android SDK key
 * validators use the same prefix). Test Store purchases are simulated, never
 * charged, and must never reach a store build (ADR-P034 S-5, owner decision D-2).
 */
const TEST_STORE_PREFIX = 'test_';

const DISABLED: SubscriptionProviderConfig = {
  enabled: false,
  apiKey: null,
  entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
};

/**
 * Resolves public SDK keys without ever falling back across platforms. A Test
 * Store key is honoured only in a development build (`__DEV__`), only on iOS or
 * Android, and only when no platform-store key is configured beside it. Error
 * messages never contain key material.
 */
export function resolveSubscriptionProviderConfig(
  platform: NativePurchasePlatform,
  environment: PublicPurchaseEnvironment = {
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY:
      process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
  },
  isDevelopmentBuild: boolean = typeof __DEV__ === 'boolean' && __DEV__,
): SubscriptionProviderConfig {
  const testStoreKey = environment.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim();
  if (testStoreKey) {
    return resolveTestStoreConfig(platform, environment, testStoreKey, isDevelopmentBuild);
  }

  if (platform !== 'ios' && platform !== 'android') return DISABLED;

  const rule = KEY_BY_PLATFORM[platform];
  const candidate = environment[rule.environmentKey]?.trim();
  if (!candidate) return DISABLED;
  if (!candidate.startsWith(rule.prefix)) {
    throw new Error(`Invalid public RevenueCat key for ${platform}`);
  }

  return { enabled: true, apiKey: candidate, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID };
}

function resolveTestStoreConfig(
  platform: NativePurchasePlatform,
  environment: PublicPurchaseEnvironment,
  testStoreKey: string,
  isDevelopmentBuild: boolean,
): SubscriptionProviderConfig {
  if (isDevelopmentBuild !== true) {
    throw new Error('RevenueCat Test Store key is not allowed outside a development build');
  }
  if (
    environment.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
    environment.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim()
  ) {
    throw new Error('RevenueCat Test Store and platform-store keys cannot be configured together');
  }
  if (
    !testStoreKey.startsWith(TEST_STORE_PREFIX) ||
    testStoreKey.length === TEST_STORE_PREFIX.length
  ) {
    throw new Error('Invalid RevenueCat Test Store key');
  }
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`RevenueCat Test Store is not supported on ${platform}`);
  }

  return { enabled: true, apiKey: testStoreKey, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID };
}
