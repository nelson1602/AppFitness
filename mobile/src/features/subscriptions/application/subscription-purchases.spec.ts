import type { Session, SessionStatus } from '@/features/authentication';

import type { PurchaseAccessSnapshot, PurchasesPort } from '../domain/purchases.port';
import { SUBSCRIPTION_ENTITLEMENT_ID } from '../infrastructure/revenuecat-config';
import {
  SubscriptionProviderError,
  SubscriptionPurchases,
  SubscriptionSessionChangedError,
  SubscriptionUnavailableError,
  type SubscriptionSessionSnapshot,
} from './subscription-purchases';

const RAW_PROVIDER_TEXT =
  'appl_LeakedPublicKey0123 sk_LeakedSecret4567 appUserID=3b7d4e1d-35ac-4ec8-8887-c16d623aa8da';

function rawProviderError(): Error {
  const error = new Error(RAW_PROVIDER_TEXT) as Error & { userInfo?: unknown };
  error.userInfo = { payload: RAW_PROVIDER_TEXT };
  return error;
}

/** Everything a receiver could render or log, flattened so a leak anywhere is caught. */
function exposedText(value: unknown): string {
  const described = value instanceof Error ? `${value.name} ${value.message}` : '';
  return `${described} ${JSON.stringify(value)}`;
}

function reportedText(report: jest.Mock): string {
  return report.mock.calls
    .map(([scope, error]: [string, unknown]) => `${scope} ${exposedText(error)}`)
    .join('\n');
}

function sessionFor(userId: string): Session {
  return {
    accessToken: `${userId}-access`,
    refreshToken: `${userId}-refresh`,
    user: {
      id: userId,
      email: `${userId}@example.test`,
      username: userId,
      role: 'USER',
      phone: null,
      avatarUrl: null,
    },
  };
}

function sessionSource() {
  let generation = 0;
  let session: Session | null = null;
  const listeners = new Set<(status: SessionStatus, value: Session | null) => void>();
  const source = {
    getSessionSnapshot: (): (SubscriptionSessionSnapshot & { generation: number }) | null =>
      session ? { userId: session.user.id, generation } : null,
    isSessionCurrent: (snapshot: SubscriptionSessionSnapshot & { generation?: number }) =>
      snapshot.generation === generation && session?.user.id === snapshot.userId,
    subscribe: (listener: (status: SessionStatus, value: Session | null) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    becomeUser: (userId: string) => {
      generation += 1;
      session = sessionFor(userId);
      for (const listener of listeners) listener('authenticated', session);
    },
    signOut: () => {
      generation += 1;
      session = null;
      for (const listener of listeners) listener('unauthenticated', null);
    },
  };
  return source;
}

function purchasePort(overrides: Partial<PurchasesPort> = {}) {
  const active: PurchaseAccessSnapshot = {
    isActive: true,
    expiresAt: '2026-11-30T00:00:00.000Z',
    productId: 'appfitness_monthly',
    willRenew: true,
  };
  return {
    configure: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue(active),
    ...overrides,
  } as jest.Mocked<PurchasesPort>;
}

const enabledConfig = {
  enabled: true,
  apiKey: 'goog_public',
  entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
} as const;

describe('SubscriptionPurchases', () => {
  it('does not configure the provider before an authenticated session exists', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());

    manager.start();
    await manager.waitForPendingWork();

    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it('reports a startup identity failure when a session already exists', async () => {
    const sessions = sessionSource();
    sessions.becomeUser('account-a');
    const report = jest.fn();
    const purchases = purchasePort({
      configure: jest.fn().mockRejectedValue(new Error('failure')),
    });
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, report);

    manager.start();
    await manager.waitForPendingWork();

    expect(report).toHaveBeenCalledWith('subscriptions.identity', expect.any(Error));
  });

  it('configures with the authenticated UUID and switches A -> B directly', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());
    manager.start();

    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();
    sessions.becomeUser('account-b');
    await manager.waitForPendingWork();

    expect(purchases.configure).toHaveBeenCalledWith({
      apiKey: 'goog_public',
      appUserId: 'account-a',
      entitlementId: 'appfitness_pro',
    });
    expect(purchases.logIn).toHaveBeenCalledTimes(1);
    expect(purchases.logIn).toHaveBeenCalledWith('account-b');
  });

  it('blocks signed-out operations and directly adopts the next authenticated owner', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());
    manager.start();
    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();

    sessions.signOut();
    await expect(manager.restorePurchases()).rejects.toBeInstanceOf(
      SubscriptionSessionChangedError,
    );
    sessions.becomeUser('account-b');
    await manager.waitForPendingWork();

    expect(purchases.restorePurchases).not.toHaveBeenCalled();
    expect(purchases.logIn).toHaveBeenCalledWith('account-b');
  });

  it('retries identity alignment after a provider failure without poisoning the queue', async () => {
    const sessions = sessionSource();
    const report = jest.fn();
    const purchases = purchasePort({
      configure: jest
        .fn()
        .mockRejectedValueOnce(new Error('provider detail'))
        .mockResolvedValueOnce(undefined),
    });
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, report);
    manager.start();

    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();
    sessions.becomeUser('account-b');
    await manager.waitForPendingWork();

    expect(report).toHaveBeenCalledWith(
      'subscriptions.identity',
      expect.any(SubscriptionProviderError),
    );
    expect(purchases.configure).toHaveBeenLastCalledWith(
      expect.objectContaining({ appUserId: 'account-b' }),
    );
  });

  it('restores only on an explicit authenticated call', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());
    manager.start();
    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();

    const result = await manager.restorePurchases();

    expect(result.isActive).toBe(true);
    expect(purchases.restorePurchases).toHaveBeenCalledWith('appfitness_pro');
  });

  it('discards a restore result when the authenticated account changes mid-flight', async () => {
    let finishRestore!: (value: PurchaseAccessSnapshot) => void;
    const pendingRestore = new Promise<PurchaseAccessSnapshot>((resolve) => {
      finishRestore = resolve;
    });
    const sessions = sessionSource();
    const purchases = purchasePort({ restorePurchases: jest.fn(() => pendingRestore) });
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());
    manager.start();
    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();

    const restoring = manager.restorePurchases();
    await Promise.resolve();
    sessions.becomeUser('account-b');
    finishRestore({ isActive: true, expiresAt: null, productId: 'old', willRenew: false });

    await expect(restoring).rejects.toBeInstanceOf(SubscriptionSessionChangedError);
    await manager.waitForPendingWork();
    expect(purchases.logIn).toHaveBeenCalledWith('account-b');
  });

  it('stays inert when the build has no provider key', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(
      purchases,
      { enabled: false, apiKey: null, entitlementId: SUBSCRIPTION_ENTITLEMENT_ID },
      sessions,
      jest.fn(),
    );
    manager.start();
    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();

    await expect(manager.restorePurchases()).rejects.toBeInstanceOf(SubscriptionUnavailableError);
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it('can stop and restart without duplicate subscriptions', async () => {
    const sessions = sessionSource();
    const purchases = purchasePort();
    const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, jest.fn());
    manager.start();
    manager.start();
    manager.stop();
    sessions.becomeUser('account-a');
    await manager.waitForPendingWork();
    expect(purchases.configure).not.toHaveBeenCalled();

    manager.start();
    await manager.waitForPendingWork();
    expect(purchases.configure).toHaveBeenCalledTimes(1);
  });

  describe('provider error containment', () => {
    it('replaces a raw restore failure with a safe typed error', async () => {
      const sessions = sessionSource();
      const report = jest.fn();
      const purchases = purchasePort({
        restorePurchases: jest.fn().mockRejectedValue(rawProviderError()),
      });
      const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, report);
      manager.start();
      sessions.becomeUser('account-a');
      await manager.waitForPendingWork();

      const failure: unknown = await manager.restorePurchases().catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(SubscriptionProviderError);
      expect(failure).toMatchObject({ operation: 'restore' });
      expect(failure).not.toHaveProperty('cause');
      expect(exposedText(failure)).not.toContain('Leaked');
      expect(exposedText(failure)).not.toContain('3b7d4e1d');
      expect(report).not.toHaveBeenCalled();
    });

    it('fails a restore safely when identity alignment fails', async () => {
      const sessions = sessionSource();
      sessions.becomeUser('account-a');
      const report = jest.fn();
      const purchases = purchasePort({
        configure: jest.fn().mockRejectedValue(rawProviderError()),
      });
      const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, report);
      manager.start();
      await manager.waitForPendingWork();

      const failure: unknown = await manager.restorePurchases().catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(SubscriptionProviderError);
      expect(failure).toMatchObject({ operation: 'configure' });
      expect(exposedText(failure)).not.toContain('Leaked');
      expect(purchases.restorePurchases).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledTimes(1);
      expect(reportedText(report)).not.toContain('Leaked');
      expect(reportedText(report)).not.toContain('3b7d4e1d');
    });

    it('reports a failed account switch without the raw provider text', async () => {
      const sessions = sessionSource();
      const report = jest.fn();
      const purchases = purchasePort({
        logIn: jest.fn().mockRejectedValue(rawProviderError()),
      });
      const manager = new SubscriptionPurchases(purchases, enabledConfig, sessions, report);
      manager.start();
      sessions.becomeUser('account-a');
      await manager.waitForPendingWork();
      sessions.becomeUser('account-b');
      await manager.waitForPendingWork();

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        'subscriptions.identity',
        expect.objectContaining({ name: 'SubscriptionProviderError', operation: 'logIn' }),
      );
      expect(reportedText(report)).not.toContain('Leaked');
      expect(reportedText(report)).not.toContain('3b7d4e1d');
    });

    it('keeps the availability and session errors unchanged', () => {
      expect(new SubscriptionUnavailableError()).toMatchObject({
        name: 'SubscriptionUnavailableError',
        message: 'Subscriptions are unavailable in this build',
      });
      expect(new SubscriptionSessionChangedError()).toMatchObject({
        name: 'SubscriptionSessionChangedError',
        message: 'The authenticated account changed during the purchase operation',
      });
    });
  });
});
