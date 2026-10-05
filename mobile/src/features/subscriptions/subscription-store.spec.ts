type StoreModule = typeof import('./subscription-store');
type RuntimeModule = typeof import('./subscription-runtime');
type AccessModule = typeof import('@/shared/application/entitlement-access');
type Listener = (status: string, session: FakeSession | null) => void;

interface FakeSession {
  readonly user: { readonly id: string };
  readonly generation: number;
}

const ANDROID_KEY = 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY';
const TEST_STORE_KEY = 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY';
const ACCOUNT_A = '7f1c9d2e-4b3a-4c5d-8e6f-0a1b2c3d4e5f';
const ACCOUNT_B = '2d4e6f8a-1b3c-4d5e-9f0a-b1c2d3e4f5a6';

interface Harness {
  readonly store: StoreModule;
  readonly runtime: RuntimeModule;
  readonly access: AccessModule;
  readonly constructed: jest.Mock;
  readonly getAccess: jest.Mock;
  readonly logError: jest.Mock;
  signIn(userId: string): void;
  signOut(): void;
  /** Holds the next access read for `userId` until `release` is called. */
  holdAccess(userId: string): { release(): void };
  startLikeRootLayout(): void;
}

/**
 * Loads the real subscription store, purchase runtime and entitlement
 * projection in their production import order, against a session source that
 * notifies listeners in registration order like `session-manager.ts` does.
 */
function loadHarness(options: { entitled: string[]; signedInAs?: string }): Harness {
  const listeners = new Set<Listener>();
  let generation = 0;
  let session: FakeSession | null = options.signedInAs
    ? { user: { id: options.signedInAs }, generation: ++generation }
    : null;
  const snapshotOf = (s: FakeSession) => ({
    userId: s.user.id,
    generation: s.generation,
    accessToken: 'access',
    user: s.user,
  });
  const emit = () => {
    for (const listener of listeners) listener(session ? 'authenticated' : 'signedOut', session);
  };

  const entitled = new Set(options.entitled);
  const holds = new Map<string, Promise<void>>();
  let providerUserId: string | null = null;
  const constructed = jest.fn();
  const logError = jest.fn();
  const getAccess = jest.fn(async () => {
    const owner = providerUserId;
    const hold = owner ? holds.get(owner) : undefined;
    if (owner && hold) {
      holds.delete(owner);
      await hold;
    }
    const isActive = owner !== null && entitled.has(owner);
    return { isActive, expiresAt: null, productId: null, willRenew: isActive };
  });

  let store!: StoreModule;
  let runtime!: RuntimeModule;
  let access!: AccessModule;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      Linking: { openURL: jest.fn() },
    }));
    jest.doMock('@/shared/infrastructure/logging', () => ({ logError }));
    jest.doMock('@/features/authentication', () => ({
      getSession: () => session,
      getSessionSnapshot: () => (session ? snapshotOf(session) : null),
      requireSessionSnapshot: () => {
        if (!session) throw new Error('Not authenticated');
        return snapshotOf(session);
      },
      isSessionCurrent: (snapshot: { userId: string; generation: number }) =>
        session !== null &&
        snapshot.userId === session.user.id &&
        snapshot.generation === session.generation,
      refreshTokens: jest.fn(),
      subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      // Same contract as session-scope.ts: synchronous reset on owner change.
      bindStoreToSession: (reset: () => void) => {
        let owner = session?.user.id ?? null;
        listeners.add((_status, next) => {
          const id = next?.user.id ?? null;
          if (id === owner) return;
          owner = id;
          reset();
        });
      },
    }));
    jest.doMock('react-native-purchases', () => {
      throw new Error('the native SDK must never load in this test');
    });
    jest.doMock('./infrastructure/revenuecat-purchases.adapter', () => ({
      RevenueCatPurchasesAdapter: class {
        constructor() {
          constructed();
        }
        configure = jest.fn(async (input: { appUserId: string }) => {
          providerUserId = input.appUserId;
        });
        logIn = jest.fn(async (userId: string) => {
          providerUserId = userId;
        });
        getAccess = getAccess;
        restorePurchases = getAccess;
        loadMonthlyOffer = jest.fn(async () => null);
        purchase = jest.fn();
        openManagement = jest.fn();
      },
    }));
    // Production import order: the feature barrel (and so the store module)
    // is evaluated before the root layout calls the initializers.
    /* eslint-disable @typescript-eslint/no-require-imports */
    store = require('./subscription-store') as StoreModule;
    runtime = require('./subscription-runtime') as RuntimeModule;
    access = require('@/shared/application/entitlement-access') as AccessModule;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });

  return {
    store,
    runtime,
    access,
    constructed,
    getAccess,
    logError,
    signIn: (userId) => {
      session = { user: { id: userId }, generation: ++generation };
      emit();
    },
    signOut: () => {
      session = null;
      emit();
    },
    holdAccess: (userId) => {
      let release!: () => void;
      holds.set(userId, new Promise<void>((resolve) => (release = resolve)));
      return { release: () => release() };
    },
    startLikeRootLayout: () => {
      runtime.initializeSubscriptionPurchases();
      store.initializeSubscriptionAccessEnforcement();
    },
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('subscription store session lifecycle (BUG-031)', () => {
  const original = { android: process.env[ANDROID_KEY], testStore: process.env[TEST_STORE_KEY] };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env[ANDROID_KEY] = 'goog_public';
    delete process.env[TEST_STORE_KEY];
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;
  });

  afterAll(() => {
    if (original.android === undefined) delete process.env[ANDROID_KEY];
    else process.env[ANDROID_KEY] = original.android;
    if (original.testStore === undefined) delete process.env[TEST_STORE_KEY];
    else process.env[TEST_STORE_KEY] = original.testStore;
    globalThis.fetch = originalFetch;
  });

  it('makes an active subscriber writable after sign-in without visiting /subscription', async () => {
    const harness = loadHarness({ entitled: [ACCOUNT_A] });
    harness.startLikeRootLayout();
    await settle();

    harness.signIn(ACCOUNT_A);
    await settle();

    const { status, issue } = harness.store.subscriptionStore.getState();
    expect({
      access: harness.access.getEntitlementAccess(),
      status,
      issue,
      providerReads: harness.getAccess.mock.calls.length,
    }).toEqual({
      access: { mode: 'active', userId: ACCOUNT_A },
      status: 'ready',
      issue: null,
      providerReads: 1,
    });
  });

  it('makes an active subscriber writable after a cold-start session restoration', async () => {
    const harness = loadHarness({ entitled: [ACCOUNT_A] });
    harness.startLikeRootLayout();
    expect(harness.access.getEntitlementAccess().mode).toBe('checking');

    // The persisted session is restored after the composition root ran.
    harness.signIn(ACCOUNT_A);
    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'checking', userId: ACCOUNT_A });
    await settle();

    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'active', userId: ACCOUNT_A });
  });

  it('reads access for a session that already exists when the root layout starts', async () => {
    const harness = loadHarness({ entitled: [ACCOUNT_A], signedInAs: ACCOUNT_A });
    harness.startLikeRootLayout();
    await settle();

    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'active', userId: ACCOUNT_A });
  });

  it('keeps an account without an entitlement read-only after sign-in', async () => {
    const harness = loadHarness({ entitled: [] });
    harness.startLikeRootLayout();
    await settle();

    harness.signIn(ACCOUNT_B);
    await settle();

    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'read-only', userId: ACCOUNT_B });
  });

  it("never publishes the previous account's result after an account switch", async () => {
    const harness = loadHarness({ entitled: [ACCOUNT_A] });
    harness.startLikeRootLayout();
    await settle();
    const published: unknown[] = [];
    harness.access.subscribeEntitlementAccess(() =>
      published.push(harness.access.getEntitlementAccess()),
    );

    const heldA = harness.holdAccess(ACCOUNT_A);
    harness.signIn(ACCOUNT_A);
    await settle();
    harness.signIn(ACCOUNT_B);
    heldA.release();
    await settle();

    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'read-only', userId: ACCOUNT_B });
    expect(published).not.toContainEqual({ mode: 'active', userId: ACCOUNT_A });
    expect(published).not.toContainEqual({ mode: 'active', userId: ACCOUNT_B });
  });

  it('initializes idempotently: one adapter and one access read per session change', async () => {
    const harness = loadHarness({ entitled: [ACCOUNT_A] });
    harness.startLikeRootLayout();
    harness.startLikeRootLayout();
    await settle();

    harness.signIn(ACCOUNT_A);
    await settle();

    expect(harness.constructed).toHaveBeenCalledTimes(1);
    expect(harness.getAccess).toHaveBeenCalledTimes(1);
    expect(harness.access.getEntitlementAccess()).toEqual({ mode: 'active', userId: ACCOUNT_A });
  });
});
