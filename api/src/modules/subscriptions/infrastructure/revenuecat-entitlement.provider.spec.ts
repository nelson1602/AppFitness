import type { EnabledRevenueCatConfig } from '../../../config/revenuecat.config';
import {
  RevenueCatEntitlementProvider,
  type RevenueCatFetch,
} from './revenuecat-entitlement.provider';

const config: EnabledRevenueCatConfig = {
  provider: 'revenuecat',
  secretApiKey: 'sk_test',
  webhookAuthToken: 'a'.repeat(32),
  webhookSigningSecret: 'b'.repeat(32),
  entitlementId: 'appfitness_pro',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RevenueCatEntitlementProvider', () => {
  let fetchMock: jest.MockedFunction<RevenueCatFetch>;
  let provider: RevenueCatEntitlementProvider;

  beforeEach(() => {
    fetchMock = jest.fn();
    provider = new RevenueCatEntitlementProvider(config, fetchMock);
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-09-29T16:00:00.000Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('normalizes the configured active entitlement and matching subscription', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        subscriber: {
          entitlements: {
            appfitness_pro: {
              expires_date: '2026-10-29T16:00:00.000Z',
              grace_period_expires_date: null,
              product_identifier: 'appfitness_pro_monthly',
            },
          },
          subscriptions: {
            appfitness_pro_monthly: {
              period_type: 'trial',
              store: 'play_store',
              is_sandbox: true,
              refunded_at: null,
              unsubscribe_detected_at: null,
            },
          },
        },
      }),
    );

    await expect(provider.getEntitlement('user id')).resolves.toEqual({
      entitlementId: 'appfitness_pro',
      isActive: true,
      expiresAt: new Date('2026-10-29T16:00:00.000Z'),
      periodType: 'trial',
      productId: 'appfitness_pro_monthly',
      store: 'play_store',
      environment: 'SANDBOX',
      willRenew: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.revenuecat.com/v1/subscribers/user%20id');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer sk_test',
    );
  });

  it('uses a later grace expiry and preserves cancellation until expiry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        subscriber: {
          entitlements: {
            appfitness_pro: {
              expires_date: '2026-09-28T16:00:00.000Z',
              grace_period_expires_date: '2026-10-02T16:00:00.000Z',
              product_identifier: 'monthly',
            },
          },
          subscriptions: {
            monthly: {
              period_type: 'normal',
              store: 'app_store',
              is_sandbox: false,
              refunded_at: null,
              unsubscribe_detected_at: '2026-09-20T00:00:00.000Z',
            },
          },
        },
      }),
    );

    const result = await provider.getEntitlement('user');
    expect(result).toEqual(
      expect.objectContaining({
        isActive: true,
        expiresAt: new Date('2026-10-02T16:00:00.000Z'),
        willRenew: false,
        environment: 'PRODUCTION',
      }),
    );
  });

  it('returns an inactive snapshot when the entitlement is absent', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ subscriber: { entitlements: {}, subscriptions: {} } }),
    );
    await expect(provider.getEntitlement('user')).resolves.toEqual({
      entitlementId: 'appfitness_pro',
      isActive: false,
      expiresAt: null,
      periodType: null,
      productId: null,
      store: null,
      environment: null,
      willRenew: null,
    });
  });

  it('treats a refund or elapsed expiry as inactive', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        subscriber: {
          entitlements: {
            appfitness_pro: {
              expires_date: '2026-09-28T00:00:00.000Z',
              grace_period_expires_date: null,
              product_identifier: 'monthly',
            },
          },
          subscriptions: {
            monthly: {
              refunded_at: '2026-09-27T00:00:00.000Z',
              unsubscribe_detected_at: null,
            },
          },
        },
      }),
    );
    expect((await provider.getEntitlement('user')).isActive).toBe(false);
  });

  it('rejects malformed and unsuccessful provider responses without exposing bodies', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'secret body' }, 500),
    );
    await expect(provider.getEntitlement('user')).rejects.toThrow(
      'RevenueCat customer lookup failed (500)',
    );

    fetchMock.mockResolvedValueOnce(jsonResponse({ subscriber: null }));
    await expect(provider.getEntitlement('user')).rejects.toThrow(
      'Malformed RevenueCat customer response',
    );
  });

  it('treats both 200 and 404 deletion as retry-safe completion', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(
      provider.ensureCustomerDeleted('user'),
    ).resolves.toBeUndefined();
    await expect(
      provider.ensureCustomerDeleted('user'),
    ).resolves.toBeUndefined();
  });

  it('fails customer deletion on every other status', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(provider.ensureCustomerDeleted('user')).rejects.toThrow(
      'RevenueCat customer deletion failed (503)',
    );
  });
});
