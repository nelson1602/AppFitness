import {
  resolveSubscriptionProviderConfig,
  SUBSCRIPTION_ENTITLEMENT_ID,
} from './revenuecat-config';

describe('resolveSubscriptionProviderConfig', () => {
  it('uses the build environment when no explicit environment is supplied', () => {
    expect(resolveSubscriptionProviderConfig('web')).toEqual({
      enabled: false,
      apiKey: null,
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
  });

  it.each(['web', 'windows', 'macos', 'other'] as const)(
    'keeps the provider disabled on %s',
    (platform) => {
      expect(
        resolveSubscriptionProviderConfig(platform, {
          EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_public',
          EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_public',
        }),
      ).toEqual({ enabled: false, apiKey: null, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID });
    },
  );

  it('keeps an iOS build inert when its key is absent', () => {
    expect(resolveSubscriptionProviderConfig('ios', {})).toEqual({
      enabled: false,
      apiKey: null,
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
  });

  it('selects only the public key belonging to the native platform', () => {
    const environment = {
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_ios-public',
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_android-public',
    };

    expect(resolveSubscriptionProviderConfig('ios', environment)).toEqual({
      enabled: true,
      apiKey: 'appl_ios-public',
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
    expect(resolveSubscriptionProviderConfig('android', environment)).toEqual({
      enabled: true,
      apiKey: 'goog_android-public',
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
  });

  it.each([
    ['ios', { EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'goog_wrong-store' }],
    ['android', { EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'appl_wrong-store' }],
  ] as const)('fails closed when the %s key has the wrong prefix', (platform, environment) => {
    expect(() => resolveSubscriptionProviderConfig(platform, environment)).toThrow(
      `Invalid public RevenueCat key for ${platform}`,
    );
  });
});
