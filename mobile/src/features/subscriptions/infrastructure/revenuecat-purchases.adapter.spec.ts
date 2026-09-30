import { RevenueCatPurchasesAdapter, type RevenueCatLoader } from './revenuecat-purchases.adapter';

function sdkModule(overrides: Record<string, unknown> = {}) {
  const sdk = {
    configure: jest.fn(),
    isConfigured: jest.fn().mockResolvedValue(false),
    getAppUserID: jest.fn().mockResolvedValue('account-a'),
    logIn: jest.fn().mockResolvedValue({ customerInfo: {}, created: false }),
    restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    ...overrides,
  };
  const load = jest.fn().mockResolvedValue({ default: sdk }) as unknown as RevenueCatLoader;
  return { sdk, load };
}

describe('RevenueCatPurchasesAdapter', () => {
  it('configures once with only the public key and authenticated account UUID', async () => {
    const { sdk, load } = sdkModule();
    const adapter = new RevenueCatPurchasesAdapter(load);

    await adapter.configure({
      apiKey: 'goog_public',
      appUserId: '3b7d4e1d-35ac-4ec8-8887-c16d623aa8da',
      entitlementId: 'appfitness_pro',
    });

    expect(sdk.configure).toHaveBeenCalledWith({
      apiKey: 'goog_public',
      appUserID: '3b7d4e1d-35ac-4ec8-8887-c16d623aa8da',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('adopts the requested owner without reconfiguring an existing SDK', async () => {
    const { sdk, load } = sdkModule({
      isConfigured: jest.fn().mockResolvedValue(true),
      getAppUserID: jest.fn().mockResolvedValue('account-a'),
    });
    const adapter = new RevenueCatPurchasesAdapter(load);

    await adapter.configure({
      apiKey: 'goog_public',
      appUserId: 'account-b',
      entitlementId: 'appfitness_pro',
    });

    expect(sdk.configure).not.toHaveBeenCalled();
    expect(sdk.logIn).toHaveBeenCalledWith('account-b');
  });

  it('does not log in again when an existing SDK already owns the requested UUID', async () => {
    const { sdk, load } = sdkModule({ isConfigured: jest.fn().mockResolvedValue(true) });
    const adapter = new RevenueCatPurchasesAdapter(load);

    await adapter.configure({
      apiKey: 'goog_public',
      appUserId: 'account-a',
      entitlementId: 'appfitness_pro',
    });

    expect(sdk.configure).not.toHaveBeenCalled();
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it('switches accounts directly and never needs a provider logout', async () => {
    const { sdk, load } = sdkModule();
    const adapter = new RevenueCatPurchasesAdapter(load);

    await adapter.logIn('account-b');

    expect(sdk.logIn).toHaveBeenCalledWith('account-b');
  });

  it('returns only the normalized standing entitlement from restore', async () => {
    const { sdk, load } = sdkModule({
      restorePurchases: jest.fn().mockResolvedValue({
        entitlements: {
          active: {
            appfitness_pro: {
              isActive: true,
              expirationDate: '2026-11-30T00:00:00.000Z',
              productIdentifier: 'appfitness_monthly',
              willRenew: true,
              latestPurchaseDate: 'not-forwarded',
            },
          },
        },
      }),
    });
    const adapter = new RevenueCatPurchasesAdapter(load);

    await expect(adapter.restorePurchases('appfitness_pro')).resolves.toEqual({
      isActive: true,
      expiresAt: '2026-11-30T00:00:00.000Z',
      productId: 'appfitness_monthly',
      willRenew: true,
    });
    expect(sdk.restorePurchases).toHaveBeenCalledTimes(1);
  });

  it('returns an inactive snapshot when the entitlement is absent', async () => {
    const { load } = sdkModule();
    const adapter = new RevenueCatPurchasesAdapter(load);

    await expect(adapter.restorePurchases('appfitness_pro')).resolves.toEqual({
      isActive: false,
      expiresAt: null,
      productId: null,
      willRenew: false,
    });
  });
});
