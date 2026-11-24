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
  rejectSandbox: false,
  sandboxAllowedUserIds: new Set<string>(),
};

const USER = '3f0c8d2e-1b2a-4c3d-8e9f-0a1b2c3d4e5f';
const BASE = `https://api.revenuecat.com/v1/subscribers/${USER}/entitlements/appfitness_pro`;

describe('RevenueCat promotional entitlements (ADR-P049 amendment 1)', () => {
  let fetchMock: jest.MockedFunction<RevenueCatFetch>;
  let provider: RevenueCatEntitlementProvider;

  beforeEach(() => {
    fetchMock = jest.fn();
    provider = new RevenueCatEntitlementProvider(config, fetchMock);
  });

  it('grants with the duration in a JSON body, server key only', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
    await provider.grantPromotional(USER, 'monthly');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/promotional`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ duration: 'monthly' }));
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer sk_test',
      'Content-Type': 'application/json',
    });
  });

  it('revokes every promotional of the entitlement', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await provider.revokePromotionals(USER);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/revoke_promotionals`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it.each([400, 404, 500])(
    'throws when RevenueCat answers %i',
    async (status) => {
      fetchMock.mockResolvedValue(new Response('{}', { status }));
      await expect(provider.grantPromotional(USER, 'yearly')).rejects.toThrow(
        `(${status})`,
      );
      await expect(provider.revokePromotionals(USER)).rejects.toThrow(
        `(${status})`,
      );
    },
  );
});
