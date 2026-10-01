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
    readonly getAccess: jest.Mock;
    readonly loadMonthlyOffer: jest.Mock;
    readonly purchase: jest.Mock;
    readonly openManagement: jest.Mock;
  };
  readonly sdkLoaded: jest.Mock;
  readonly openURL: jest.Mock;
}

interface ReconciliationHarness {
  readonly runtime: SubscriptionRuntime;
  readonly fetch: jest.Mock;
  readonly refreshTokens: jest.Mock;
  readonly isSessionCurrent: jest.Mock;
  setSnapshot(next: Record<string, unknown>): void;
}

function loadReconciliationRuntime(): ReconciliationHarness {
  const user = { id: ACCOUNT_ID, email: 'owner@example.test', username: 'owner' };
  let snapshot: Record<string, unknown> = {
    generation: 1,
    userId: ACCOUNT_ID,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    user,
  };
  const fetchMock = jest.fn();
  const refreshTokens = jest.fn();
  const isSessionCurrent = jest.fn(() => true);
  let runtime!: SubscriptionRuntime;

  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' }, Linking: {} }));
    jest.doMock('@/features/authentication', () => ({
      getSessionSnapshot: () => snapshot,
      isSessionCurrent,
      refreshTokens,
      requireSessionSnapshot: () => snapshot,
      subscribe: jest.fn(() => () => undefined),
    }));
    jest.doMock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));
    globalThis.fetch = fetchMock as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    runtime = require('./subscription-runtime') as SubscriptionRuntime;
  });

  return {
    runtime,
    fetch: fetchMock,
    refreshTokens,
    isSessionCurrent,
    setSnapshot: (next) => {
      snapshot = next;
    },
  };
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
    getAccess: jest.fn().mockResolvedValue({
      isActive: false,
      expiresAt: null,
      productId: null,
      willRenew: false,
    }),
    loadMonthlyOffer: jest.fn().mockResolvedValue(null),
    purchase: jest.fn().mockResolvedValue({ kind: 'cancelled' }),
    openManagement: jest.fn().mockResolvedValue(undefined),
  };
  const openURL = jest.fn().mockResolvedValue(undefined);
  const snapshot = signedIn ? { userId: ACCOUNT_ID, generation: 1 } : null;

  let runtime!: SubscriptionRuntime;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: platform }, Linking: { openURL } }));
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
        constructor(...args: unknown[]) {
          adapter.constructed(...args);
        }
        configure = adapter.configure;
        logIn = adapter.logIn;
        restorePurchases = adapter.restorePurchases;
        getAccess = adapter.getAccess;
        loadMonthlyOffer = adapter.loadMonthlyOffer;
        purchase = adapter.purchase;
        openManagement = adapter.openManagement;
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    runtime = require('./subscription-runtime') as SubscriptionRuntime;
  });
  return { runtime, logError, subscribe, adapter, sdkLoaded, openURL };
}

function expectNoProviderCall(harness: Harness): void {
  expect(harness.sdkLoaded).not.toHaveBeenCalled();
  expect(harness.adapter.configure).not.toHaveBeenCalled();
  expect(harness.adapter.logIn).not.toHaveBeenCalled();
  expect(harness.adapter.restorePurchases).not.toHaveBeenCalled();
  expect(harness.adapter.getAccess).not.toHaveBeenCalled();
  expect(harness.adapter.loadMonthlyOffer).not.toHaveBeenCalled();
  expect(harness.adapter.purchase).not.toHaveBeenCalled();
  expect(harness.adapter.openManagement).not.toHaveBeenCalled();
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

describe('subscription runtime S-3 entry points', () => {
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

  it('reports the ADR-P019 Web boundary without initializing anything', () => {
    process.env[IOS_KEY] = 'appl_public';
    const harness = loadRuntime('web');

    expect(harness.runtime.getSubscriptionAvailability()).toBe('web');
    expect(harness.adapter.constructed).not.toHaveBeenCalled();
  });

  it('reports an unconfigured native build without loading the SDK', () => {
    const harness = loadRuntime('ios');

    expect(harness.runtime.getSubscriptionAvailability()).toBe('unconfigured');
    expectNoProviderCall(harness);
  });

  it('reports a malformed key as unconfigured', () => {
    process.env[ANDROID_KEY] = 'appl_wrong-store';
    const harness = loadRuntime('android');

    expect(harness.runtime.getSubscriptionAvailability()).toBe('unconfigured');
    expect(harness.adapter.constructed).not.toHaveBeenCalled();
  });

  it('reports availability and delegates every operation for a configured build', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android');

    expect(harness.runtime.getSubscriptionAvailability()).toBe('available');
    await harness.runtime.loadSubscriptionAccess();
    await harness.runtime.loadSubscriptionOffer();
    await harness.runtime.openSubscriptionManagement();

    expect(harness.adapter.getAccess).toHaveBeenCalledWith('appfitness_pro');
    expect(harness.adapter.loadMonthlyOffer).toHaveBeenCalledTimes(1);
    expect(harness.adapter.openManagement).toHaveBeenCalledTimes(1);
  });

  it('builds the adapter for the platform and routes Android management URLs to Linking', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android');
    harness.runtime.initializeSubscriptionPurchases();

    const [loader, platform, opener] = harness.adapter.constructed.mock.calls[0] as [
      unknown,
      string,
      (url: string) => Promise<void>,
    ];
    expect(loader).toBeUndefined();
    expect(platform).toBe('android');
    await opener('https://play.google.com/store/account/subscriptions');
    expect(harness.openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/account/subscriptions',
    );
  });

  it('builds the iOS adapter on iOS', () => {
    process.env[IOS_KEY] = 'appl_public';
    const harness = loadRuntime('ios');
    harness.runtime.initializeSubscriptionPurchases();

    expect(harness.adapter.constructed.mock.calls[0]?.[1]).toBe('ios');
  });

  it('refuses a purchase of an offer this session never loaded', async () => {
    process.env[ANDROID_KEY] = 'goog_public';
    const harness = loadRuntime('android');

    await expect(
      harness.runtime.purchaseSubscriptionOffer(
        'offer-1' as Parameters<SubscriptionRuntime['purchaseSubscriptionOffer']>[0],
      ),
    ).rejects.toMatchObject({ name: 'SubscriptionSessionChangedError' });
    expect(harness.adapter.purchase).not.toHaveBeenCalled();
  });

  it.each([
    'loadSubscriptionAccess',
    'loadSubscriptionOffer',
    'openSubscriptionManagement',
  ] as const)('fails %s safely without a usable runtime', async (entry) => {
    process.env[IOS_KEY] = 'goog_WrongStoreKeyValue0123';
    const harness = loadRuntime('ios');

    await expect(harness.runtime[entry]()).rejects.toMatchObject(UNAVAILABLE);
    expectNoProviderCall(harness);
  });
});

describe('subscription runtime S-4 server reconciliation', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('posts only the bearer token to the reconciliation endpoint', async () => {
    const harness = loadReconciliationRuntime();
    harness.fetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(harness.runtime.reconcileServerSubscription()).resolves.toBeUndefined();

    expect(harness.fetch).toHaveBeenCalledWith('http://localhost:3001/subscriptions/reconcile', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-1' },
    });
  });

  it('refreshes once after 401 and retries with the rotated token', async () => {
    const harness = loadReconciliationRuntime();
    const rotated = {
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      user: { id: ACCOUNT_ID, email: 'owner@example.test', username: 'owner' },
    };
    harness.fetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    harness.refreshTokens.mockImplementation(async () => {
      harness.setSnapshot({ ...rotated, generation: 2, userId: ACCOUNT_ID });
      return rotated;
    });

    await expect(harness.runtime.reconcileServerSubscription()).resolves.toBeUndefined();

    expect(harness.refreshTokens).toHaveBeenCalledTimes(1);
    expect(harness.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/subscriptions/reconcile',
      expect.objectContaining({ headers: { Authorization: 'Bearer access-2' } }),
    );
  });

  it('fails safely on refusal without exposing the response body', async () => {
    const harness = loadReconciliationRuntime();
    harness.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('provider secret and account details'),
    });

    await expect(harness.runtime.reconcileServerSubscription()).rejects.toMatchObject({
      name: 'SubscriptionReconciliationError',
      message: 'The server entitlement mirror could not be reconciled',
    });
  });
});
