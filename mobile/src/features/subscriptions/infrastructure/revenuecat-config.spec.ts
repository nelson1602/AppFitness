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

describe('resolveSubscriptionProviderConfig — RevenueCat Test Store (S-5, D-2)', () => {
  // Synthetic placeholders: never a real key.
  const TEST_KEY = 'test_SyntheticPlaceholderValue0';
  const REJECTED_KEY_FRAGMENTS = ['SyntheticPlaceholderValue0', 'PlatformPlaceholder1'];

  function rejectionMessage(run: () => unknown): string {
    try {
      run();
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error('expected a configuration rejection');
  }

  it.each(['ios', 'android'] as const)(
    'accepts a Test Store key only in a development build on %s',
    (platform) => {
      expect(
        resolveSubscriptionProviderConfig(
          platform,
          { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: ` ${TEST_KEY} ` },
          true,
        ),
      ).toEqual({ enabled: true, apiKey: TEST_KEY, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID });
    },
  );

  it.each(['ios', 'android', 'web'] as const)(
    'refuses a Test Store key outside the development boundary on %s',
    (platform) => {
      const message = rejectionMessage(() =>
        resolveSubscriptionProviderConfig(
          platform,
          { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY },
          false,
        ),
      );
      expect(message).toBe('RevenueCat Test Store key is not allowed outside a development build');
    },
  );

  it.each([
    ['ios', { EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_PlatformPlaceholder1' }],
    ['android', { EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_PlatformPlaceholder1' }],
    ['ios', { EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_PlatformPlaceholder1' }],
  ] as const)(
    'refuses a Test Store key configured beside a platform-store key (%s)',
    (platform, platformKeys) => {
      const message = rejectionMessage(() =>
        resolveSubscriptionProviderConfig(
          platform,
          { ...platformKeys, EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY },
          true,
        ),
      );
      expect(message).toBe(
        'RevenueCat Test Store and platform-store keys cannot be configured together',
      );
    },
  );

  it.each([
    'test_',
    'appl_SyntheticPlaceholderValue0',
    'goog_SyntheticPlaceholderValue0',
    'rcb_SyntheticPlaceholderValue0',
    'TEST_SyntheticPlaceholderValue0',
  ])('refuses a malformed Test Store key (%#)', (malformed) => {
    const message = rejectionMessage(() =>
      resolveSubscriptionProviderConfig(
        'android',
        { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: malformed },
        true,
      ),
    );
    expect(message).toBe('Invalid RevenueCat Test Store key');
  });

  it.each(['web', 'windows', 'macos', 'other'] as const)(
    'refuses a Test Store key on the unsupported platform %s',
    (platform) => {
      const message = rejectionMessage(() =>
        resolveSubscriptionProviderConfig(
          platform,
          { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY },
          true,
        ),
      );
      expect(message).toBe(`RevenueCat Test Store is not supported on ${platform}`);
    },
  );

  it('ignores a blank Test Store key and keeps the platform-store and inert behaviour', () => {
    const blank = { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: '   ' };
    expect(resolveSubscriptionProviderConfig('ios', blank, true)).toEqual({
      enabled: false,
      apiKey: null,
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
    expect(
      resolveSubscriptionProviderConfig(
        'android',
        { ...blank, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_android-public' },
        false,
      ),
    ).toEqual({
      enabled: true,
      apiKey: 'goog_android-public',
      entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
    });
  });

  it('leaves platform-store keys unchanged in release and development builds', () => {
    const environment = {
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_ios-public',
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_android-public',
    };
    for (const isDevelopmentBuild of [true, false]) {
      expect(resolveSubscriptionProviderConfig('ios', environment, isDevelopmentBuild)).toEqual({
        enabled: true,
        apiKey: 'appl_ios-public',
        entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
      });
      expect(() =>
        resolveSubscriptionProviderConfig(
          'ios',
          { EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'goog_wrong-store' },
          isDevelopmentBuild,
        ),
      ).toThrow('Invalid public RevenueCat key for ios');
    }
  });

  it('never places key material in any rejection message', () => {
    const cases: [
      Parameters<typeof resolveSubscriptionProviderConfig>[1],
      boolean,
      'ios' | 'web',
    ][] = [
      [{ EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY }, false, 'ios'],
      [
        {
          EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY,
          EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_PlatformPlaceholder1',
        },
        true,
        'ios',
      ],
      [
        { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: 'rcb_SyntheticPlaceholderValue0' },
        true,
        'ios',
      ],
      [{ EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY }, true, 'web'],
      [{ EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'goog_PlatformPlaceholder1' }, false, 'ios'],
    ];
    for (const [environment, isDevelopmentBuild, platform] of cases) {
      const message = rejectionMessage(() =>
        resolveSubscriptionProviderConfig(platform, environment, isDevelopmentBuild),
      );
      for (const fragment of REJECTED_KEY_FRAGMENTS) expect(message).not.toContain(fragment);
      expect(message).not.toMatch(/(test|appl|goog|rcb)_\w/);
    }
  });

  it('uses the build __DEV__ flag as the boundary by default', () => {
    const globals = globalThis as { __DEV__?: boolean };
    const original = globals.__DEV__;
    const environment = { EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY: TEST_KEY };
    try {
      globals.__DEV__ = false;
      expect(() => resolveSubscriptionProviderConfig('ios', environment)).toThrow(
        'RevenueCat Test Store key is not allowed outside a development build',
      );
      globals.__DEV__ = true;
      expect(resolveSubscriptionProviderConfig('ios', environment).apiKey).toBe(TEST_KEY);
    } finally {
      globals.__DEV__ = original;
    }
  });
});
