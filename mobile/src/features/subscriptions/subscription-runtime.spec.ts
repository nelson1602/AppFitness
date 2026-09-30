type SubscriptionRuntime = typeof import('./subscription-runtime');
type TestPlatform = 'ios' | 'android' | 'web';

const IOS_KEY = 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY';
const ANDROID_KEY = 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY';
const ACCOUNT_ID = '3b7d4e1d-35ac-4ec8-8887-c16d623aa8da';
// Matched by name: the isolated registry owns its own copy of the error class.
const UNAVAILABLE = { name: 'SubscriptionUnavailableError' };

interface Harness {
  readonly runtime: SubscriptionRuntime;
  readonly logError: jest.Mock;
  readonly subscribe: jest.Mock;
  readonly adapter: {
    readonly constructed: jest.Mock;
    readonly configure: jest.Mock;
    readonly logIn: jest.Mock;
    readonly restorePurchases: jest.Mock;
  };
  readonly sdkLoaded: jest.Mock;
}

/**
 * Loads a fresh copy of the runtime (own module-level state) against mocked
 * platform, session source, logger, adapter and SDK module. No public reset
 * API exists; isolation is the only way to observe first initialization.
 */
function loadRuntime(platform: TestPlatform, signedIn = true): Harness {
  const logError = jest.fn();
  const subscribe = jest.fn(() => () => undefined);
  const sdkLoaded = jest.fn();
  const adapter = {
    constructed: jest.fn(),
    configure: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue({
      isActive: false,
      expiresAt: null,
      productId: null,
      willRenew: false,
    }),
  };
  const snapshot = signedIn ? { userId: ACCOUNT_ID, generation: 1 } : null;

  let runtime!: SubscriptionRuntime;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
    jest.doMock('@/features/authentication', () => ({
      getSessionSnapshot: () => snapshot,
      isSessionCurrent: () => signedIn,
      subscribe,
    }));
    jest.doMock('@/shared/infrastructure/logging', () => ({ logError }));
    jest.doMock('react-native-purchases', () => {
      sdkLoaded();
      return { default: {} };
    });
    jest.doMock('./infrastructure/revenuecat-purchases.adapter', () => ({
      RevenueCatPurchasesAdapter: class {
        constructor() {
          adapter.constructed();
        }
        configure = adapter.configure;
        logIn = adapter.logIn;
        restorePurchases = adapter.restorePurchases;
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    runtime = require('./subscription-runtime') as SubscriptionRuntime;
  });
  return { runtime, logError, subscribe, adapter, sdkLoaded };
}

function expectNoProviderCall(harness: Harness): void {
  expect(harness.sdkLoaded).not.toHaveBeenCalled();
  expect(harness.adapter.configure).not.toHaveBeenCalled();
  expect(harness.adapter.logIn).not.toHaveBeenCalled();
  expect(harness.adapter.restorePurchases).not.toHaveBeenCalled();
}

describe('subscription runtime composition', () => {
  const original = { ios: process.env[IOS_KEY], android: process.env[ANDROID_KEY] };

  beforeEach(() => {
    delete process.env[IOS_KEY];
    delete process.env[ANDROID_KEY];
  });

  afterAll(() => {
    if (original.ios === undefined) delete process.env[IOS_KEY];
    else process.env[IOS_KEY] = original.ios;
    if (original.android === undefined) delete process.env[ANDROID_KEY];
    else process.env[ANDROID_KEY] = original.android;
  });

  it.each(['ios', 'android', 'web'] as const)(
    'stays inert on %s without a public key and never reaches the SDK',
    async (platform) => {
      const harness = loadRuntime(platform);

      harness.runtime.initializeSubscriptionPurchases();
      await expect(harness.runtime.restoreSubscriptionPurchases()).rejects.toMatchObject(
        UNAVAILABLE,
      );

      expectNoProviderCall(harness);
      expect(harness.logError).not.toHaveBeenCalled();
    },
  );

  it('keeps Web inert even when native keys are present', async () => {
    process.env[IOS_KEY] = 'appl_public';
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('web');

    harness.runtime.initializeSubscriptionPurchases();
    await expect(harness.runtime.restoreSubscriptionPurchases()).rejects.toMatchObject(UNAVAILABLE);

    expectNoProviderCall(harness);
  });

  it('logs one safe configuration failure for a malformed key and stays unavailable', async () => {
    const malformed = 'goog_WrongStoreKeyValue0123';
    process.env[IOS_KEY] = malformed;
    const harness = loadRuntime('ios');

    harness.runtime.initializeSubscriptionPurchases();
    harness.runtime.initializeSubscriptionPurchases();
    await expect(harness.runtime.restoreSubscriptionPurchases()).rejects.toMatchObject(UNAVAILABLE);

    expect(harness.logError).toHaveBeenCalledTimes(1);
    const [scope, error] = harness.logError.mock.calls[0] as [string, Error];
    expect(scope).toBe('subscriptions.configuration');
    expect(error.message).not.toContain(malformed);
    expect(harness.adapter.constructed).not.toHaveBeenCalled();
    expectNoProviderCall(harness);
  });

  it('initializes idempotently: one adapter and one session subscription', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android');

    harness.runtime.initializeSubscriptionPurchases();
    harness.runtime.initializeSubscriptionPurchases();
    await Promise.resolve();

    expect(harness.adapter.constructed).toHaveBeenCalledTimes(1);
    expect(harness.subscribe).toHaveBeenCalledTimes(1);
  });

  it('initializes on first restore and delegates only for an authenticated session', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android');

    await expect(harness.runtime.restoreSubscriptionPurchases()).resolves.toMatchObject({
      isActive: false,
    });

    expect(harness.adapter.constructed).toHaveBeenCalledTimes(1);
    expect(harness.adapter.configure).toHaveBeenCalledWith(
      expect.objectContaining({ appUserId: ACCOUNT_ID }),
    );
    expect(harness.adapter.restorePurchases).toHaveBeenCalledWith('appfitness_pro');
  });

  it('rejects a restore while signed out without configuring the provider', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android', false);

    await expect(harness.runtime.restoreSubscriptionPurchases()).rejects.toMatchObject({
      name: 'SubscriptionSessionChangedError',
    });

    expectNoProviderCall(harness);
  });
});
