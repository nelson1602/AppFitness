import { resolveRevenueCatConfig } from './revenuecat.config';

const enabled = (): NodeJS.ProcessEnv => ({
  REVENUECAT_PROVIDER: 'revenuecat',
  REVENUECAT_SECRET_API_KEY: 'sk_secret',
  REVENUECAT_WEBHOOK_AUTH_TOKEN: 'a'.repeat(32),
  REVENUECAT_WEBHOOK_SIGNING_SECRET: 'b'.repeat(32),
  REVENUECAT_ENTITLEMENT_ID: 'appfitness_pro',
});

describe('resolveRevenueCatConfig', () => {
  it('is disabled when the provider is unset or explicitly disabled', () => {
    expect(resolveRevenueCatConfig({})).toEqual({ provider: 'disabled' });
    expect(
      resolveRevenueCatConfig({ REVENUECAT_PROVIDER: ' disabled ' }),
    ).toEqual({ provider: 'disabled' });
  });

  it('resolves a complete enabled configuration', () => {
    expect(resolveRevenueCatConfig(enabled())).toEqual({
      provider: 'revenuecat',
      secretApiKey: 'sk_secret',
      webhookAuthToken: 'a'.repeat(32),
      webhookSigningSecret: 'b'.repeat(32),
      entitlementId: 'appfitness_pro',
    });
  });

  it.each([
    'REVENUECAT_SECRET_API_KEY',
    'REVENUECAT_WEBHOOK_AUTH_TOKEN',
    'REVENUECAT_WEBHOOK_SIGNING_SECRET',
    'REVENUECAT_ENTITLEMENT_ID',
  ])('fails closed when enabled without %s', (name) => {
    const env = enabled();
    delete env[name];
    expect(() => resolveRevenueCatConfig(env)).toThrow(name);
  });

  it('rejects weak local webhook secrets and malformed identifiers', () => {
    expect(() =>
      resolveRevenueCatConfig({
        ...enabled(),
        REVENUECAT_WEBHOOK_AUTH_TOKEN: 'short',
      }),
    ).toThrow(/32 characters/);
    expect(() =>
      resolveRevenueCatConfig({
        ...enabled(),
        REVENUECAT_ENTITLEMENT_ID: 'contains space',
      }),
    ).toThrow(/1-255/);
  });

  it('rejects an unknown provider rather than degrading to disabled', () => {
    expect(() =>
      resolveRevenueCatConfig({ REVENUECAT_PROVIDER: 'other' }),
    ).toThrow(/Unsupported REVENUECAT_PROVIDER/);
  });
});
