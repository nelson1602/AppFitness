import type {
  PurchaseAccessSnapshot,
  PurchaseOutcome,
  SubscriptionOffer,
  SubscriptionOfferHandle,
} from '../domain/purchases.port';
import {
  SubscriptionProviderError,
  SubscriptionSessionChangedError,
  SubscriptionUnavailableError,
  type SubscriptionSessionSnapshot,
} from './subscription-purchases';
import {
  createSubscriptionStore,
  MAX_SAME_ACCOUNT_RELOADS,
  type EntitlementAccessPublisher,
  type SubscriptionAvailability,
  type SubscriptionGateway,
} from './subscription.store';

const inactive: PurchaseAccessSnapshot = {
  isActive: false,
  expiresAt: null,
  productId: null,
  willRenew: false,
};
const active: PurchaseAccessSnapshot = {
  isActive: true,
  expiresAt: '2026-11-30T00:00:00.000Z',
  productId: 'store_product_monthly',
  willRenew: true,
};
const offer: SubscriptionOffer = {
  handle: 'offer-1' as SubscriptionOfferHandle,
  productId: 'store_product_monthly',
  price: 'RD$ 295.00',
  billingPeriod: { unit: 'month', count: 1 },
  freeTrial: { unit: 'month', count: 1 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sessionsFor(initial: string | null) {
  let generation = 1;
  let userId = initial;
  return {
    getSessionSnapshot: (): (SubscriptionSessionSnapshot & { generation: number }) | null =>
      userId ? { userId, generation } : null,
    isSessionCurrent: (snapshot: SubscriptionSessionSnapshot & { generation?: number }) =>
      snapshot.userId === userId && snapshot.generation === generation,
    become: (next: string | null) => {
      generation += 1;
      userId = next;
    },
  };
}

function gatewayWith(overrides: Partial<SubscriptionGateway> = {}) {
  return {
    availability: jest.fn((): SubscriptionAvailability => 'available'),
    storeKind: jest.fn(() => 'apple' as const),
    loadAccess: jest.fn().mockResolvedValue(inactive),
    loadOffer: jest.fn().mockResolvedValue(offer),
    purchase: jest.fn().mockResolvedValue({ kind: 'completed', access: active }),
    restore: jest.fn().mockResolvedValue(active),
    manage: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function accessPublisher(): jest.Mocked<EntitlementAccessPublisher> {
  return {
    configure: jest.fn(),
    begin: jest.fn(),
    set: jest.fn(),
    reset: jest.fn(),
  };
}

function setup(
  overrides: Partial<SubscriptionGateway> = {},
  user: string | null = 'account-a',
  entitlementAccess: EntitlementAccessPublisher = accessPublisher(),
) {
  const gateway = gatewayWith(overrides);
  const sessions = sessionsFor(user);
  const report = jest.fn();
  const store = createSubscriptionStore(gateway, sessions, report, entitlementAccess);
  return { gateway, sessions, report, store, entitlementAccess };
}

async function ready(overrides: Partial<SubscriptionGateway> = {}) {
  const context = setup(overrides);
  await context.store.getState().load();
  return context;
}

describe('subscription store — load', () => {
  it('fails closed while loading and publishes the provider answer', async () => {
    const pending = deferred<PurchaseAccessSnapshot>();
    const { store, entitlementAccess } = setup({ loadAccess: jest.fn(() => pending.promise) });

    const loading = store.getState().load();
    expect(entitlementAccess.configure).toHaveBeenCalledWith(true);
    expect(entitlementAccess.begin).toHaveBeenCalledWith('account-a');

    pending.resolve(active);
    await loading;
    expect(entitlementAccess.set).toHaveBeenCalledWith('account-a', true);
  });

  it.each(['web', 'unconfigured'] as const)(
    'keeps enforcement dormant for a %s build',
    async (availability) => {
      const { store, entitlementAccess } = setup({ availability: jest.fn(() => availability) });

      await store.getState().load();
      expect(entitlementAccess.configure).toHaveBeenCalledWith(false);
      expect(entitlementAccess.begin).not.toHaveBeenCalled();
    },
  );

  it('publishes read-only when access cannot be confirmed', async () => {
    const { store, entitlementAccess } = setup({
      loadAccess: jest.fn().mockRejectedValue(new SubscriptionProviderError('access', 'network')),
    });

    await store.getState().load();
    expect(entitlementAccess.set).toHaveBeenCalledWith('account-a', false);
  });

  it('starts idle, then shows the offer for an inactive account', async () => {
    const { store } = setup();
    expect(store.getState().status).toBe('idle');

    const loading = store.getState().load();
    expect(store.getState().status).toBe('loading');
    await loading;

    expect(store.getState()).toMatchObject({ status: 'ready', access: inactive, offer });
  });

  it('shows active access without loading an offer', async () => {
    const { store, gateway } = await ready({ loadAccess: jest.fn().mockResolvedValue(active) });

    expect(store.getState()).toMatchObject({ status: 'ready', access: active, offer: null });
    expect(gateway.loadOffer).not.toHaveBeenCalled();
  });

  it('records a missing store offer as no offer instead of fabricating one', async () => {
    const { store } = await ready({ loadOffer: jest.fn().mockResolvedValue(null) });

    expect(store.getState()).toMatchObject({ status: 'ready', offer: null, access: inactive });
  });

  it('renders the Web boundary without touching the provider', async () => {
    const { store, gateway } = setup({ availability: jest.fn(() => 'web' as const) });
    await store.getState().load();

    expect(store.getState().status).toBe('web-unavailable');
    expect(gateway.loadAccess).not.toHaveBeenCalled();
    expect(gateway.loadOffer).not.toHaveBeenCalled();
  });

  it('keeps an unconfigured build unavailable and performs no provider operation', async () => {
    const { store, gateway } = setup({ availability: jest.fn(() => 'unconfigured' as const) });
    await store.getState().load();

    expect(store.getState().status).toBe('unavailable');
    for (const call of [
      gateway.loadAccess,
      gateway.loadOffer,
      gateway.purchase,
      gateway.restore,
      gateway.manage,
    ]) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  it('does nothing while signed out', async () => {
    const { store, gateway } = setup({}, null);
    await store.getState().load();

    expect(store.getState().status).toBe('idle');
    expect(gateway.loadAccess).not.toHaveBeenCalled();
  });

  it('maps a network failure to Offline, not Error', async () => {
    const { store, report } = await ready({
      loadOffer: jest.fn().mockRejectedValue(new SubscriptionProviderError('offer', 'network')),
    });

    expect(store.getState()).toMatchObject({ status: 'offline', offer: null });
    expect(report).not.toHaveBeenCalled();
  });

  it('maps any other failure to Error and reports only the safe typed error', async () => {
    const failure = new SubscriptionProviderError('access');
    const { store, report } = await ready({ loadAccess: jest.fn().mockRejectedValue(failure) });

    expect(store.getState()).toMatchObject({ status: 'error', issue: null });
    expect(report).toHaveBeenCalledWith('subscriptions.load', failure);
  });

  it('maps an unavailable runtime to the unavailable state', async () => {
    const { store } = await ready({
      loadAccess: jest.fn().mockRejectedValue(new SubscriptionUnavailableError()),
    });

    expect(store.getState().status).toBe('unavailable');
  });

  it('never publishes an earlier account result onto the next account', async () => {
    const offerLoad = deferred<SubscriptionOffer | null>();
    const { store, sessions } = setup({ loadOffer: jest.fn(() => offerLoad.promise) });

    const loading = store.getState().load();
    await Promise.resolve();
    sessions.become('account-b');
    store.getState().reset();
    offerLoad.resolve(offer);
    await loading;

    expect(store.getState()).toMatchObject({
      status: 'idle',
      offer: null,
      access: null,
      issue: null,
    });
  });

  describe('same-account session refresh during the entitlement read (S-4)', () => {
    type AccessModule = typeof import('@/shared/application/entitlement-access');

    /** The real projection, isolated per test, so the final mode is observed. */
    function realAccess(): { module: AccessModule; publisher: EntitlementAccessPublisher } {
      let module!: AccessModule;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('@/shared/application/entitlement-access') as AccessModule;
      });
      return {
        module,
        publisher: {
          configure: module.configureEntitlementEnforcement,
          begin: module.beginEntitlementCheck,
          set: module.setEntitlementAccess,
          reset: module.resetEntitlementAccess,
        },
      };
    }

    it('re-reads for the current account and never stays checking', async () => {
      const { module, publisher } = realAccess();
      const first = deferred<PurchaseAccessSnapshot>();
      const loadAccess = jest
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(active);
      const { store, sessions } = setup({ loadAccess }, 'account-a', publisher);

      const loading = store.getState().load();
      expect(module.getEntitlementAccess().mode).toBe('checking');
      sessions.become('account-a');
      first.resolve(inactive);
      await loading;

      expect(loadAccess).toHaveBeenCalledTimes(2);
      expect(module.getEntitlementAccess()).toEqual({ mode: 'active', userId: 'account-a' });
      expect(store.getState()).toMatchObject({ status: 'ready', access: active, issue: null });
    });

    it('never publishes the stale generation result', async () => {
      const publisher = accessPublisher();
      const first = deferred<PurchaseAccessSnapshot>();
      const loadAccess = jest
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(inactive);
      const { store, sessions } = setup({ loadAccess }, 'account-a', publisher);

      const loading = store.getState().load();
      sessions.become('account-a');
      first.resolve(active);
      await loading;

      // The stale read said active; only the fresh read's inactive is published.
      expect(publisher.set).toHaveBeenCalledTimes(1);
      expect(publisher.set).toHaveBeenCalledWith('account-a', false);
      expect(publisher.set).not.toHaveBeenCalledWith('account-a', true);
    });

    it('re-reads when the refresh lands during server reconciliation', async () => {
      const { module, publisher } = realAccess();
      const reconcile = deferred<void>();
      const reconcileServer = jest
        .fn()
        .mockImplementationOnce(() => reconcile.promise)
        .mockResolvedValue(undefined);
      const loadAccess = jest.fn().mockResolvedValue(active);
      const { store, sessions } = setup({ loadAccess, reconcileServer }, 'account-a', publisher);

      const loading = store.getState().load();
      await Promise.resolve();
      await Promise.resolve();
      sessions.become('account-a');
      reconcile.resolve();
      await loading;

      expect(loadAccess).toHaveBeenCalledTimes(2);
      expect(module.getEntitlementAccess().mode).toBe('active');
      expect(store.getState()).toMatchObject({ status: 'ready', issue: null });
    });

    it('is bounded: constant churn fails closed instead of looping or checking forever', async () => {
      const { module, publisher } = realAccess();
      let sessionsRef: ReturnType<typeof sessionsFor> | null = null;
      const loadAccess = jest.fn(async () => {
        sessionsRef?.become('account-a');
        return active;
      });
      const { store, sessions } = setup({ loadAccess }, 'account-a', publisher);
      sessionsRef = sessions;

      await store.getState().load();

      expect(loadAccess).toHaveBeenCalledTimes(1 + MAX_SAME_ACCOUNT_RELOADS);
      expect(module.getEntitlementAccess()).toEqual({ mode: 'read-only', userId: 'account-a' });
      expect(store.getState()).toMatchObject({ status: 'error', issue: 'sessionChanged' });
    });

    it('never publishes across accounts: an account switch mid-read publishes nothing for the old owner', async () => {
      const publisher = accessPublisher();
      const first = deferred<PurchaseAccessSnapshot>();
      const loadAccess = jest.fn(() => first.promise);
      const { store, sessions } = setup({ loadAccess }, 'account-a', publisher);

      const loading = store.getState().load();
      sessions.become('account-b');
      store.getState().reset();
      first.resolve(active);
      await loading;

      expect(loadAccess).toHaveBeenCalledTimes(1);
      expect(publisher.set).not.toHaveBeenCalled();
      expect(publisher.reset).toHaveBeenCalledTimes(1);
      expect(store.getState()).toMatchObject({ status: 'idle', access: null });
    });

    it('re-reads after a session-changed rejection caused by a same-account refresh', async () => {
      let sessionsRef: ReturnType<typeof sessionsFor> | null = null;
      const loadAccess = jest
        .fn()
        .mockImplementationOnce(async () => {
          sessionsRef?.become('account-a');
          throw new SubscriptionSessionChangedError();
        })
        .mockResolvedValueOnce(active);
      const { module, publisher } = realAccess();
      const { store, sessions } = setup({ loadAccess }, 'account-a', publisher);
      sessionsRef = sessions;

      await store.getState().load();

      expect(loadAccess).toHaveBeenCalledTimes(2);
      expect(module.getEntitlementAccess().mode).toBe('active');
      expect(store.getState()).toMatchObject({ status: 'ready', issue: null });
    });
  });

  it('turns a session-changed rejection into the neutral retry state', async () => {
    const { store, sessions } = setup({
      loadAccess: jest.fn(async () => {
        sessions.become('account-a');
        throw new SubscriptionSessionChangedError();
      }),
    });
    await store.getState().load();

    expect(store.getState()).toMatchObject({ status: 'error', issue: 'sessionChanged' });
  });

  it('ignores a superseded load', async () => {
    const first = deferred<PurchaseAccessSnapshot>();
    const loadAccess = jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(active);
    const { store } = setup({ loadAccess });

    const stale = store.getState().load();
    await store.getState().load();
    first.resolve(inactive);
    await stale;

    expect(store.getState()).toMatchObject({ status: 'ready', access: active });
  });
});

describe('subscription store — purchase', () => {
  it('shows success only when the provider reports the entitlement active', async () => {
    const { store, gateway } = await ready();

    const buying = store.getState().purchase();
    expect(store.getState().operation).toBe('purchasing');
    await buying;

    expect(gateway.purchase).toHaveBeenCalledWith(offer.handle);
    expect(store.getState()).toMatchObject({
      operation: null,
      access: active,
      offer: null,
      notice: 'purchased',
      issue: null,
    });
  });

  it('treats cancellation as a choice: no error and no notice', async () => {
    const { store } = await ready({
      purchase: jest.fn().mockResolvedValue({ kind: 'cancelled' } satisfies PurchaseOutcome),
    });
    await store.getState().purchase();

    expect(store.getState()).toMatchObject({ operation: null, notice: null, issue: null, offer });
  });

  it.each([
    ['pending', { kind: 'pending' } as PurchaseOutcome],
    ['completed but inactive', { kind: 'completed', access: inactive } as PurchaseOutcome],
  ])('never reports a %s purchase as active', async (_case, outcome) => {
    const { store } = await ready({ purchase: jest.fn().mockResolvedValue(outcome) });
    await store.getState().purchase();

    expect(store.getState()).toMatchObject({
      purchasePending: true,
      notice: null,
      access: inactive,
      offer,
    });
  });

  describe('pending purchase guard', () => {
    async function pendingStore(overrides: Partial<SubscriptionGateway> = {}) {
      const context = await ready({
        purchase: jest.fn().mockResolvedValue({ kind: 'pending' } satisfies PurchaseOutcome),
        ...overrides,
      });
      await context.store.getState().purchase();
      expect(context.store.getState().purchasePending).toBe(true);
      return context;
    }

    it('performs no provider operation for a second purchase while pending', async () => {
      const { store, gateway } = await pendingStore();

      await store.getState().purchase();
      await store.getState().purchase();

      expect(gateway.purchase).toHaveBeenCalledTimes(1);
      expect(store.getState()).toMatchObject({ purchasePending: true, operation: null });
    });

    it('keeps restore available and pending when nothing active is restored', async () => {
      const { store, gateway } = await pendingStore({
        restore: jest.fn().mockResolvedValue(inactive),
      });

      await store.getState().restore();

      expect(gateway.restore).toHaveBeenCalledTimes(1);
      expect(store.getState()).toMatchObject({
        purchasePending: true,
        notice: 'nothingToRestore',
      });
      await store.getState().purchase();
      expect(gateway.purchase).toHaveBeenCalledTimes(1);
    });

    it('clears pending when a restore confirms the entitlement', async () => {
      const { store } = await pendingStore();

      await store.getState().restore();

      expect(store.getState()).toMatchObject({ purchasePending: false, access: active });
    });

    it('survives a focus re-read that is still inactive, and clears once active', async () => {
      const loadAccess = jest.fn().mockResolvedValue(inactive);
      const { store } = await pendingStore({ loadAccess });

      await store.getState().load();
      expect(store.getState()).toMatchObject({ status: 'ready', purchasePending: true });

      loadAccess.mockResolvedValue(active);
      await store.getState().load();
      expect(store.getState()).toMatchObject({ purchasePending: false, access: active });
    });

    it('clears the prior account pending state on reset', async () => {
      const { store } = await pendingStore();

      store.getState().reset();

      expect(store.getState().purchasePending).toBe(false);
    });

    it.each([
      ['a cancellation', jest.fn().mockResolvedValueOnce({ kind: 'cancelled' })],
      [
        'a provider failure',
        jest.fn().mockRejectedValueOnce(new SubscriptionProviderError('purchase')),
      ],
    ])('still allows a retry after %s', async (_case, purchase) => {
      purchase.mockResolvedValue({ kind: 'completed', access: active });
      const { store } = await ready({ purchase });

      await store.getState().purchase();
      expect(store.getState().purchasePending).toBe(false);
      await store.getState().purchase();

      expect(purchase).toHaveBeenCalledTimes(2);
      expect(store.getState()).toMatchObject({ access: active, notice: 'purchased' });
    });
  });

  it.each([
    ['network', 'network'],
    ['notAllowed', 'purchaseNotAllowed'],
    ['unknown', 'purchaseFailed'],
  ] as const)('maps a %s provider failure to %s', async (reason, issue) => {
    const { store } = await ready({
      purchase: jest.fn().mockRejectedValue(new SubscriptionProviderError('purchase', reason)),
    });
    await store.getState().purchase();

    expect(store.getState()).toMatchObject({ operation: null, issue, notice: null, offer });
  });

  it('reports only unclassified failures, as the safe typed error', async () => {
    const failure = new SubscriptionProviderError('purchase');
    const { store, report } = await ready({ purchase: jest.fn().mockRejectedValue(failure) });
    await store.getState().purchase();

    expect(report).toHaveBeenCalledWith('subscriptions.purchase', failure);
  });

  it('ignores a second press while an operation is in flight', async () => {
    const pending = deferred<PurchaseOutcome>();
    const purchase = jest.fn(() => pending.promise);
    const { store } = await ready({ purchase });

    const first = store.getState().purchase();
    await store.getState().purchase();
    await store.getState().restore();
    pending.resolve({ kind: 'cancelled' });
    await first;

    expect(purchase).toHaveBeenCalledTimes(1);
  });

  it('does not purchase without an offer', async () => {
    const { store, gateway } = await ready({ loadOffer: jest.fn().mockResolvedValue(null) });
    await store.getState().purchase();

    expect(gateway.purchase).not.toHaveBeenCalled();
  });

  it('drops a purchase result after an account switch', async () => {
    const pending = deferred<PurchaseOutcome>();
    const { store, sessions } = await ready({ purchase: jest.fn(() => pending.promise) });

    const buying = store.getState().purchase();
    sessions.become('account-b');
    store.getState().reset();
    pending.resolve({ kind: 'completed', access: active });
    await buying;

    expect(store.getState()).toMatchObject({
      status: 'idle',
      access: null,
      notice: null,
      issue: null,
    });
  });

  it('asks for a neutral retry when the purchase crosses a same-account refresh', async () => {
    const pending = deferred<PurchaseOutcome>();
    const { store, sessions } = await ready({ purchase: jest.fn(() => pending.promise) });

    const buying = store.getState().purchase();
    sessions.become('account-a');
    pending.resolve({ kind: 'completed', access: active });
    await buying;

    expect(store.getState()).toMatchObject({
      status: 'ready',
      operation: null,
      issue: 'sessionChanged',
      notice: null,
      access: inactive,
    });
  });

  it('maps a session-changed rejection to the neutral retry issue', async () => {
    const { store, sessions } = await ready({
      purchase: jest.fn(async () => {
        sessions.become('account-a');
        throw new SubscriptionSessionChangedError();
      }),
    });
    await store.getState().purchase();

    expect(store.getState()).toMatchObject({ operation: null, issue: 'sessionChanged' });
  });

  it('falls back to unavailable if the runtime disappears', async () => {
    const { store } = await ready({
      purchase: jest.fn().mockRejectedValue(new SubscriptionUnavailableError()),
    });
    await store.getState().purchase();

    expect(store.getState()).toMatchObject({ status: 'unavailable', offer: null });
  });
});

describe('subscription store — restore and manage', () => {
  it('restores an active entitlement', async () => {
    const { store } = await ready();

    const restoring = store.getState().restore();
    expect(store.getState().operation).toBe('restoring');
    await restoring;

    expect(store.getState()).toMatchObject({ access: active, offer: null, notice: 'restored' });
  });

  it('says plainly when nothing was restored and keeps the offer', async () => {
    const { store } = await ready({ restore: jest.fn().mockResolvedValue(inactive) });
    await store.getState().restore();

    expect(store.getState()).toMatchObject({ notice: 'nothingToRestore', offer, access: inactive });
  });

  // BUG-032: after an expiry the screen still held the earlier active
  // snapshot, so "nothing to restore" rendered next to the active card.
  it('replaces a stale active snapshot when an expired restore finds nothing', async () => {
    const { store, gateway, entitlementAccess } = await ready({
      loadAccess: jest.fn().mockResolvedValue(active),
      restore: jest.fn().mockResolvedValue(inactive),
    });
    expect(store.getState()).toMatchObject({ access: active, offer: null });

    await store.getState().restore();

    expect(store.getState()).toMatchObject({
      operation: null,
      access: inactive,
      offer,
      notice: 'nothingToRestore',
      issue: null,
    });
    expect(store.getState().access?.isActive).toBe(false);
    expect(gateway.loadOffer).toHaveBeenCalledTimes(1);
    expect(entitlementAccess.set).toHaveBeenLastCalledWith('account-a', false);
  });

  it('never keeps the active card when the offer cannot load after an empty restore', async () => {
    const { store, report } = await ready({
      loadAccess: jest.fn().mockResolvedValue(active),
      restore: jest.fn().mockResolvedValue(inactive),
      loadOffer: jest.fn().mockRejectedValue(new SubscriptionProviderError('offer')),
    });

    await store.getState().restore();

    expect(store.getState()).toMatchObject({
      operation: null,
      access: inactive,
      offer: null,
      notice: 'nothingToRestore',
    });
    expect(report).toHaveBeenCalledWith('subscriptions.restore', expect.any(Error));
  });

  it('does not reload an offer it already holds after an empty restore', async () => {
    const { store, gateway } = await ready({ restore: jest.fn().mockResolvedValue(inactive) });
    expect(gateway.loadOffer).toHaveBeenCalledTimes(1);

    await store.getState().restore();

    expect(gateway.loadOffer).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ access: inactive, offer, notice: 'nothingToRestore' });
  });

  it('restores over a stale active snapshot without touching the offer', async () => {
    const { store, gateway } = await ready({ loadAccess: jest.fn().mockResolvedValue(active) });

    await store.getState().restore();

    expect(store.getState()).toMatchObject({ access: active, offer: null, notice: 'restored' });
    expect(gateway.loadOffer).not.toHaveBeenCalled();
  });

  it('makes no offer request for an empty restore that resolves after an account switch', async () => {
    const pending = deferred<PurchaseAccessSnapshot>();
    const { store, sessions, gateway } = await ready({
      loadAccess: jest.fn().mockResolvedValue(active),
      restore: jest.fn(() => pending.promise),
    });

    const restoring = store.getState().restore();
    sessions.become('account-b');
    store.getState().reset();
    pending.resolve(inactive);
    await restoring;

    expect(gateway.loadOffer).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: 'idle', access: null, notice: null });
  });

  it('drops the offer reload of an empty restore after an account switch', async () => {
    const pendingOffer = deferred<SubscriptionOffer | null>();
    const { store, sessions, entitlementAccess } = await ready({
      loadAccess: jest.fn().mockResolvedValue(active),
      restore: jest.fn().mockResolvedValue(inactive),
      loadOffer: jest.fn(() => pendingOffer.promise),
    });

    const restoring = store.getState().restore();
    await Promise.resolve();
    await Promise.resolve();
    sessions.become('account-b');
    store.getState().reset();
    pendingOffer.resolve(offer);
    await restoring;

    expect(store.getState()).toMatchObject({
      status: 'idle',
      access: null,
      offer: null,
      notice: null,
    });
    expect(entitlementAccess.set).not.toHaveBeenCalledWith('account-b', expect.anything());
  });

  it('maps a restore failure and a restore network failure', async () => {
    const failing = await ready({
      restore: jest.fn().mockRejectedValue(new SubscriptionProviderError('restore')),
    });
    await failing.store.getState().restore();
    expect(failing.store.getState().issue).toBe('restoreFailed');

    const offline = await ready({
      restore: jest.fn().mockRejectedValue(new SubscriptionProviderError('restore', 'network')),
    });
    await offline.store.getState().restore();
    expect(offline.store.getState().issue).toBe('network');
  });

  it('drops a restore result after an account switch', async () => {
    const pending = deferred<PurchaseAccessSnapshot>();
    const { store, sessions } = await ready({ restore: jest.fn(() => pending.promise) });

    const restoring = store.getState().restore();
    sessions.become('account-b');
    store.getState().reset();
    pending.resolve(active);
    await restoring;

    expect(store.getState()).toMatchObject({ status: 'idle', access: null, notice: null });
  });

  it('opens management and clears the operation', async () => {
    const { store, gateway } = await ready({ loadAccess: jest.fn().mockResolvedValue(active) });

    const managing = store.getState().manage();
    expect(store.getState().operation).toBe('managing');
    await managing;

    expect(gateway.manage).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ operation: null, issue: null });
  });

  it('maps a management failure without raw text', async () => {
    const { store } = await ready({
      manage: jest.fn().mockRejectedValue(new SubscriptionProviderError('manage')),
    });
    await store.getState().manage();

    expect(store.getState().issue).toBe('manageFailed');
  });

  it('does not start an operation before the surface is ready', async () => {
    const { store, gateway } = setup();
    await store.getState().restore();
    await store.getState().manage();

    expect(gateway.restore).not.toHaveBeenCalled();
    expect(gateway.manage).not.toHaveBeenCalled();
  });

  it('does not start an operation once signed out', async () => {
    const { store, gateway, sessions } = await ready();
    sessions.become(null);
    await store.getState().restore();

    expect(gateway.restore).not.toHaveBeenCalled();
  });

  it('keeps the store kind across a reset', async () => {
    const { store } = setup({ storeKind: jest.fn(() => 'google' as const) });
    store.getState().reset();

    expect(store.getState().storeKind).toBe('google');
  });
});

describe('subscription store — S-4 access publication edges', () => {
  it('works without an access publisher (the no-op default)', async () => {
    const store = createSubscriptionStore(gatewayWith(), sessionsFor('account-a'), jest.fn());

    await store.getState().load();
    expect(store.getState()).toMatchObject({ status: 'ready', access: inactive });
    store.getState().reset();
    expect(store.getState().status).toBe('idle');
  });

  it('reports a failed server reconciliation but keeps the confirmed access', async () => {
    const failure = new Error('reconcile unavailable');
    const { store, report, entitlementAccess } = setup({
      loadAccess: jest.fn().mockResolvedValue(active),
      reconcileServer: jest.fn().mockRejectedValue(failure),
    });

    await store.getState().load();

    expect(report).toHaveBeenCalledWith('subscriptions.reconcile', failure);
    expect(entitlementAccess.set).toHaveBeenCalledWith('account-a', true);
    expect(store.getState()).toMatchObject({ status: 'ready', access: active });
  });

  it('fails closed on a session-changed rejection while the session is still current', async () => {
    const { store, entitlementAccess } = setup({
      loadAccess: jest.fn().mockRejectedValue(new SubscriptionSessionChangedError()),
    });

    await store.getState().load();

    expect(entitlementAccess.set).toHaveBeenCalledWith('account-a', false);
    expect(store.getState()).toMatchObject({ status: 'error', issue: 'sessionChanged' });
  });
});
