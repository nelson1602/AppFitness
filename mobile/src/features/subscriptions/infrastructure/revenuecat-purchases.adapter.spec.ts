import { PurchaseProviderFailure, type SubscriptionOfferHandle } from '../domain/purchases.port';
import { RevenueCatPurchasesAdapter, type RevenueCatLoader } from './revenuecat-purchases.adapter';

const ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1',
  STORE_PROBLEM_ERROR: '2',
  PURCHASE_NOT_ALLOWED_ERROR: '3',
  NETWORK_ERROR: '10',
  PAYMENT_PENDING_ERROR: '20',
  PRODUCT_REQUEST_TIMED_OUT_ERROR: '32',
  OFFLINE_CONNECTION_ERROR: '35',
};
const ELIGIBILITY = {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
};
/** Identifier- and secret-shaped provider text that must never be forwarded. */
const RAW = 'appl_LeakedKey0123 appUserID=3b7d4e1d-35ac-4ec8-8887-c16d623aa8da receipt=MIIT';

interface ProductOverrides {
  identifier?: string;
  priceString?: string;
  subscriptionPeriod?: string | null;
  introPrice?: Record<string, unknown> | null;
  defaultOption?: Record<string, unknown> | null;
}

function product(overrides: ProductOverrides = {}) {
  return {
    identifier: 'store_product_monthly',
    priceString: 'RD$ 295.00',
    subscriptionPeriod: 'P1M',
    introPrice: null,
    defaultOption: null,
    ...overrides,
  };
}

function offerings(monthly: unknown) {
  return { current: monthly === undefined ? null : { monthly }, all: {} };
}

function freeMonthIntro(overrides: Record<string, unknown> = {}) {
  return {
    price: 0,
    priceString: 'RD$ 0.00',
    cycles: 1,
    period: 'P1M',
    periodUnit: 'MONTH',
    periodNumberOfUnits: 1,
    ...overrides,
  };
}

function googleOption(freePhase: Record<string, unknown> | null, formatted = 'DOP 295.00') {
  return {
    fullPricePhase: {
      billingPeriod: { unit: 'MONTH', value: 1, iso8601: 'P1M' },
      price: { formatted, amountMicros: 295_000_000, currencyCode: 'DOP' },
    },
    freePhase,
  };
}

function sdkModule(overrides: Record<string, unknown> = {}) {
  const sdk = {
    PURCHASES_ERROR_CODE: ERROR_CODE,
    INTRO_ELIGIBILITY_STATUS: ELIGIBILITY,
    configure: jest.fn(),
    isConfigured: jest.fn().mockResolvedValue(false),
    getAppUserID: jest.fn().mockResolvedValue('account-a'),
    logIn: jest.fn().mockResolvedValue({ customerInfo: {}, created: false }),
    restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    getCustomerInfo: jest
      .fn()
      .mockResolvedValue({ entitlements: { active: {} }, managementURL: null }),
    getOfferings: jest.fn().mockResolvedValue(offerings({ product: product() })),
    checkTrialOrIntroductoryPriceEligibility: jest.fn().mockResolvedValue({}),
    purchasePackage: jest.fn(),
    showManageSubscriptions: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const load = jest.fn().mockResolvedValue({ default: sdk }) as unknown as RevenueCatLoader;
  return { sdk, load };
}

const activeInfo = {
  entitlements: {
    active: {
      appfitness_pro: {
        isActive: true,
        expirationDate: '2026-11-30T00:00:00.000Z',
        productIdentifier: 'store_product_monthly',
        willRenew: true,
        latestPurchaseDate: 'not-forwarded',
      },
    },
  },
  managementURL: null,
};

describe('RevenueCatPurchasesAdapter', () => {
  describe('identity (S-2)', () => {
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
  });

  describe('access and restore', () => {
    it('returns only the normalized standing entitlement from restore', async () => {
      const { sdk, load } = sdkModule({
        restorePurchases: jest.fn().mockResolvedValue(activeInfo),
      });
      const adapter = new RevenueCatPurchasesAdapter(load);

      await expect(adapter.restorePurchases('appfitness_pro')).resolves.toEqual({
        isActive: true,
        expiresAt: '2026-11-30T00:00:00.000Z',
        productId: 'store_product_monthly',
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

    it('reads current access from customer info', async () => {
      const { load } = sdkModule({ getCustomerInfo: jest.fn().mockResolvedValue(activeInfo) });
      const adapter = new RevenueCatPurchasesAdapter(load);

      await expect(adapter.getAccess('appfitness_pro')).resolves.toMatchObject({ isActive: true });
    });

    it.each([
      [ERROR_CODE.NETWORK_ERROR, 'network'],
      [ERROR_CODE.OFFLINE_CONNECTION_ERROR, 'network'],
      [ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR, 'network'],
      [ERROR_CODE.STORE_PROBLEM_ERROR, 'unknown'],
    ])(
      're-raises provider code %s as a closed %s failure without its text',
      async (code, reason) => {
        const { load } = sdkModule({
          getCustomerInfo: jest.fn().mockRejectedValue({ code, message: RAW, userInfo: { RAW } }),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        const failure: unknown = await adapter.getAccess('appfitness_pro').catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(PurchaseProviderFailure);
        expect(failure).toMatchObject({ reason });
        expect(JSON.stringify(failure)).not.toContain('Leaked');
        expect((failure as Error).message).not.toContain('3b7d4e1d');
      },
    );
  });

  describe('monthly offer', () => {
    it('selects the current offering monthly package and keeps its localized price verbatim', async () => {
      const { load } = sdkModule();
      const adapter = new RevenueCatPurchasesAdapter(load);

      const offer = await adapter.loadMonthlyOffer();

      expect(offer).toEqual({
        handle: expect.any(String),
        productId: 'store_product_monthly',
        price: 'RD$ 295.00',
        billingPeriod: { unit: 'month', count: 1 },
        freeTrial: null,
      });
    });

    it.each([
      ['there is no current offering', offerings(undefined)],
      ['the current offering has no monthly package', { current: { monthly: null }, all: {} }],
      [
        'the package is not monthly',
        offerings({ product: product({ subscriptionPeriod: 'P1Y' }) }),
      ],
      ['the period is unknown', offerings({ product: product({ subscriptionPeriod: null }) })],
      ['the price is empty', offerings({ product: product({ priceString: '' }) })],
    ])('returns no offer when %s', async (_case, value) => {
      const { load } = sdkModule({ getOfferings: jest.fn().mockResolvedValue(value) });
      const adapter = new RevenueCatPurchasesAdapter(load);

      await expect(adapter.loadMonthlyOffer()).resolves.toBeNull();
    });

    describe('iOS trial evidence', () => {
      const withIntro = (intro: Record<string, unknown>) =>
        jest.fn().mockResolvedValue(offerings({ product: product({ introPrice: intro }) }));

      it('shows the free trial only when the SDK reports eligibility', async () => {
        const { sdk, load } = sdkModule({
          getOfferings: withIntro(freeMonthIntro()),
          checkTrialOrIntroductoryPriceEligibility: jest.fn().mockResolvedValue({
            store_product_monthly: { status: ELIGIBILITY.INTRO_ELIGIBILITY_STATUS_ELIGIBLE },
          }),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        const offer = await adapter.loadMonthlyOffer();

        expect(offer?.freeTrial).toEqual({ unit: 'month', count: 1 });
        expect(offer?.price).toBe('RD$ 295.00');
        expect(sdk.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith([
          'store_product_monthly',
        ]);
      });

      it('multiplies the trial period by its store-reported cycles', async () => {
        const { load } = sdkModule({
          getOfferings: withIntro(
            freeMonthIntro({ periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 2 }),
          ),
          checkTrialOrIntroductoryPriceEligibility: jest.fn().mockResolvedValue({
            store_product_monthly: { status: ELIGIBILITY.INTRO_ELIGIBILITY_STATUS_ELIGIBLE },
          }),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({
          freeTrial: { unit: 'week', count: 2 },
        });
      });

      it.each([
        ['ineligible', { status: ELIGIBILITY.INTRO_ELIGIBILITY_STATUS_INELIGIBLE }],
        ['unknown', { status: ELIGIBILITY.INTRO_ELIGIBILITY_STATUS_UNKNOWN }],
        ['missing', undefined],
      ])('uses ordinary paid terms when eligibility is %s', async (_case, status) => {
        const { load } = sdkModule({
          getOfferings: withIntro(freeMonthIntro()),
          checkTrialOrIntroductoryPriceEligibility: jest
            .fn()
            .mockResolvedValue(status ? { store_product_monthly: status } : {}),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: null });
      });

      it('uses ordinary paid terms when the eligibility check fails', async () => {
        const { load } = sdkModule({
          getOfferings: withIntro(freeMonthIntro()),
          checkTrialOrIntroductoryPriceEligibility: jest.fn().mockRejectedValue(new Error(RAW)),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: null });
      });

      it('never treats a paid introductory price as a free trial', async () => {
        const { sdk, load } = sdkModule({
          getOfferings: withIntro(freeMonthIntro({ price: 99, priceString: 'RD$ 99.00' })),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: null });
        expect(sdk.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
      });

      it('refuses an unrepresentable trial period rather than guessing', async () => {
        const { load } = sdkModule({
          getOfferings: withIntro(freeMonthIntro({ periodUnit: 'FORTNIGHT' })),
          checkTrialOrIntroductoryPriceEligibility: jest.fn().mockResolvedValue({
            store_product_monthly: { status: ELIGIBILITY.INTRO_ELIGIBILITY_STATUS_ELIGIBLE },
          }),
        });
        const adapter = new RevenueCatPurchasesAdapter(load);

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: null });
      });
    });

    describe('Google Play subscription-option evidence', () => {
      it('uses the default option full-price phase and its free phase', async () => {
        const option = googleOption({
          billingPeriod: { unit: 'MONTH', value: 1, iso8601: 'P1M' },
          billingCycleCount: 1,
          price: { formatted: 'Free', amountMicros: 0, currencyCode: 'DOP' },
        });
        const { sdk, load } = sdkModule({
          getOfferings: jest
            .fn()
            .mockResolvedValue(
              offerings({ product: product({ priceString: 'Free', defaultOption: option }) }),
            ),
        });
        const adapter = new RevenueCatPurchasesAdapter(load, 'android');

        const offer = await adapter.loadMonthlyOffer();

        expect(offer).toMatchObject({
          price: 'DOP 295.00',
          freeTrial: { unit: 'month', count: 1 },
        });
        expect(sdk.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
      });

      it('uses ordinary paid terms when the default option has no free phase', async () => {
        const { load } = sdkModule({
          getOfferings: jest
            .fn()
            .mockResolvedValue(
              offerings({ product: product({ defaultOption: googleOption(null) }) }),
            ),
        });
        const adapter = new RevenueCatPurchasesAdapter(load, 'android');

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({
          price: 'DOP 295.00',
          freeTrial: null,
        });
      });

      it('returns no offer when the recurring price phase is missing', async () => {
        const { load } = sdkModule({
          getOfferings: jest.fn().mockResolvedValue(
            offerings({
              product: product({ defaultOption: { fullPricePhase: null, freePhase: null } }),
            }),
          ),
        });
        const adapter = new RevenueCatPurchasesAdapter(load, 'android');

        await expect(adapter.loadMonthlyOffer()).resolves.toBeNull();
      });
    });
  });

  describe('purchase', () => {
    async function loaded(overrides: Record<string, unknown> = {}) {
      const monthly = { identifier: '$rc_monthly', product: product() };
      const { sdk, load } = sdkModule({
        getOfferings: jest.fn().mockResolvedValue(offerings(monthly)),
        ...overrides,
      });
      const adapter = new RevenueCatPurchasesAdapter(load);
      const offer = await adapter.loadMonthlyOffer();
      if (!offer) throw new Error('fixture offer missing');
      return { sdk, adapter, offer, monthly };
    }

    it('buys the exact package the offer load returned', async () => {
      const { sdk, adapter, offer, monthly } = await loaded({
        purchasePackage: jest.fn().mockResolvedValue({ customerInfo: activeInfo }),
      });

      await expect(adapter.purchase(offer.handle, 'appfitness_pro')).resolves.toEqual({
        kind: 'completed',
        access: expect.objectContaining({ isActive: true }),
      });
      expect(sdk.purchasePackage).toHaveBeenCalledWith(monthly);
    });

    it.each([
      ['a cancellation code', { code: ERROR_CODE.PURCHASE_CANCELLED_ERROR, message: RAW }],
      ['the legacy cancelled flag', { code: ERROR_CODE.STORE_PROBLEM_ERROR, userCancelled: true }],
    ])('reports %s as cancelled, not as an error', async (_case, error) => {
      const { adapter, offer } = await loaded({
        purchasePackage: jest.fn().mockRejectedValue(error),
      });

      await expect(adapter.purchase(offer.handle, 'appfitness_pro')).resolves.toEqual({
        kind: 'cancelled',
      });
    });

    it('reports a pending payment as pending, never as active', async () => {
      const { adapter, offer } = await loaded({
        purchasePackage: jest
          .fn()
          .mockRejectedValue({ code: ERROR_CODE.PAYMENT_PENDING_ERROR, message: RAW }),
      });

      await expect(adapter.purchase(offer.handle, 'appfitness_pro')).resolves.toEqual({
        kind: 'pending',
      });
    });

    it.each([
      [ERROR_CODE.NETWORK_ERROR, 'network'],
      [ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR, 'notAllowed'],
      [ERROR_CODE.STORE_PROBLEM_ERROR, 'unknown'],
    ])('classifies purchase code %s as %s without the provider text', async (code, reason) => {
      const { adapter, offer } = await loaded({
        purchasePackage: jest.fn().mockRejectedValue({ code, message: RAW }),
      });

      const failure: unknown = await adapter
        .purchase(offer.handle, 'appfitness_pro')
        .catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(PurchaseProviderFailure);
      expect(failure).toMatchObject({ reason });
      expect(JSON.stringify(failure)).not.toContain('Leaked');
    });

    it('refuses a handle it did not issue and never reconstructs a package', async () => {
      const { sdk, adapter } = await loaded();

      await expect(
        adapter.purchase('offer-999' as SubscriptionOfferHandle, 'appfitness_pro'),
      ).rejects.toBeInstanceOf(PurchaseProviderFailure);
      expect(sdk.purchasePackage).not.toHaveBeenCalled();
    });

    it('invalidates the previous handle when the offer is reloaded', async () => {
      const { sdk, adapter, offer } = await loaded();
      await adapter.loadMonthlyOffer();

      await expect(adapter.purchase(offer.handle, 'appfitness_pro')).rejects.toBeInstanceOf(
        PurchaseProviderFailure,
      );
      expect(sdk.purchasePackage).not.toHaveBeenCalled();
    });
  });

  describe('defensive normalization', () => {
    it('closes a failure to load the native module without its text', async () => {
      const load = jest.fn().mockRejectedValue(new Error(RAW)) as unknown as RevenueCatLoader;
      const adapter = new RevenueCatPurchasesAdapter(load);

      const failure: unknown = await adapter.getAccess('appfitness_pro').catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(PurchaseProviderFailure);
      expect(failure).toMatchObject({ reason: 'unknown' });
      expect(JSON.stringify(failure)).not.toContain('Leaked');
    });

    it.each([
      ['an unknown Google phase unit', { unit: 'UNKNOWN', value: 1, iso8601: 'P1X' }, 1],
      ['a zero-length Google phase', { unit: 'MONTH', value: 0, iso8601: 'P0M' }, 1],
      ['zero Google billing cycles', { unit: 'MONTH', value: 1, iso8601: 'P1M' }, 0],
      ['an unknown (null) Google cycle count', { unit: 'WEEK', value: 1, iso8601: 'P1W' }, null],
      ['a negative Google cycle count', { unit: 'MONTH', value: 1, iso8601: 'P1M' }, -1],
      ['a fractional Google cycle count', { unit: 'MONTH', value: 1, iso8601: 'P1M' }, 1.5],
      ['a non-numeric Google cycle count', { unit: 'MONTH', value: 1, iso8601: 'P1M' }, '1'],
      ['a negative Google period value', { unit: 'MONTH', value: -1, iso8601: 'P-1M' }, 1],
      ['a fractional Google period value', { unit: 'WEEK', value: 0.5, iso8601: 'P0.5W' }, 1],
    ])('refuses %s as a trial', async (_case, billingPeriod, billingCycleCount) => {
      const option = googleOption({
        billingPeriod,
        billingCycleCount,
        price: { formatted: 'Free', amountMicros: 0, currencyCode: 'DOP' },
      });
      const { load } = sdkModule({
        getOfferings: jest
          .fn()
          .mockResolvedValue(offerings({ product: product({ defaultOption: option }) })),
      });
      const adapter = new RevenueCatPurchasesAdapter(load, 'android');

      await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: null });
    });

    it.each([
      [{ unit: 'WEEK', value: 1, iso8601: 'P1W' }, 2, { unit: 'week', count: 2 }],
      [{ unit: 'DAY', value: 7, iso8601: 'P7D' }, 2, { unit: 'day', count: 14 }],
      [{ unit: 'MONTH', value: 1, iso8601: 'P1M' }, 1, { unit: 'month', count: 1 }],
    ])(
      'multiplies a valid Google free phase %j by %i cycles',
      async (billingPeriod, billingCycleCount, expected) => {
        const option = googleOption({
          billingPeriod,
          billingCycleCount,
          price: { formatted: 'Free', amountMicros: 0, currencyCode: 'DOP' },
        });
        const { load } = sdkModule({
          getOfferings: jest
            .fn()
            .mockResolvedValue(offerings({ product: product({ defaultOption: option }) })),
        });
        const adapter = new RevenueCatPurchasesAdapter(load, 'android');

        await expect(adapter.loadMonthlyOffer()).resolves.toMatchObject({ freeTrial: expected });
      },
    );

    it('returns no offer for a zero-length billing period', async () => {
      const { load } = sdkModule({
        getOfferings: jest
          .fn()
          .mockResolvedValue(offerings({ product: product({ subscriptionPeriod: 'P0M' }) })),
      });
      const adapter = new RevenueCatPurchasesAdapter(load);

      await expect(adapter.loadMonthlyOffer()).resolves.toBeNull();
    });

    it.each([
      ['a numeric code', { code: 10 }],
      ['a bare string', RAW],
      ['null', null],
    ])('classifies a purchase rejection with %s as unknown', async (_case, rejection) => {
      const monthly = { identifier: '$rc_monthly', product: product() };
      const { load } = sdkModule({
        getOfferings: jest.fn().mockResolvedValue(offerings(monthly)),
        purchasePackage: jest.fn().mockRejectedValue(rejection),
      });
      const adapter = new RevenueCatPurchasesAdapter(load);
      const offer = await adapter.loadMonthlyOffer();

      await expect(adapter.purchase(offer!.handle, 'appfitness_pro')).rejects.toMatchObject({
        name: 'PurchaseProviderFailure',
        reason: 'unknown',
      });
    });
  });

  describe('subscription management', () => {
    it('presents the App Store management sheet on iOS', async () => {
      const { sdk, load } = sdkModule();
      const adapter = new RevenueCatPurchasesAdapter(load, 'ios');

      await adapter.openManagement();

      expect(sdk.showManageSubscriptions).toHaveBeenCalledTimes(1);
      expect(sdk.getCustomerInfo).not.toHaveBeenCalled();
    });

    it('opens the provider management URL on Android', async () => {
      const openUrl = jest.fn().mockResolvedValue(undefined);
      const { sdk, load } = sdkModule({
        getCustomerInfo: jest.fn().mockResolvedValue({
          entitlements: { active: {} },
          managementURL: 'https://play.google.com/store/account/subscriptions',
        }),
      });
      const adapter = new RevenueCatPurchasesAdapter(load, 'android', openUrl);

      await adapter.openManagement();

      expect(openUrl).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
      expect(sdk.showManageSubscriptions).not.toHaveBeenCalled();
    });

    it.each([null, 'javascript:alert(1)', 'market://details'])(
      'refuses to open a missing or non-https management URL (%s)',
      async (managementURL) => {
        const openUrl = jest.fn();
        const { load } = sdkModule({
          getCustomerInfo: jest
            .fn()
            .mockResolvedValue({ entitlements: { active: {} }, managementURL }),
        });
        const adapter = new RevenueCatPurchasesAdapter(load, 'android', openUrl);

        await expect(adapter.openManagement()).rejects.toBeInstanceOf(PurchaseProviderFailure);
        expect(openUrl).not.toHaveBeenCalled();
      },
    );

    it('fails closed on Android when no URL opener is supplied', async () => {
      const { load } = sdkModule({
        getCustomerInfo: jest.fn().mockResolvedValue({
          entitlements: { active: {} },
          managementURL: 'https://play.google.com/store/account/subscriptions',
        }),
      });
      const adapter = new RevenueCatPurchasesAdapter(load, 'android');

      await expect(adapter.openManagement()).rejects.toBeInstanceOf(PurchaseProviderFailure);
    });
  });
});
