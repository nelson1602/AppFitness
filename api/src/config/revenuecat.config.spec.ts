import {
  describeRevenueCatMode,
  parseSandboxUserIds,
  resolveRevenueCatConfig,
} from './revenuecat.config';

const TESTER = '11111111-1111-4111-8111-111111111111';

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
      rejectSandbox: false,
      sandboxAllowedUserIds: new Set(),
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

  describe('ADR-P046 production rules', () => {
    it('refuses to boot in production without an explicit REVENUECAT_PROVIDER', () => {
      expect(() => resolveRevenueCatConfig({ NODE_ENV: 'production' })).toThrow(
        'REVENUECAT_PROVIDER must be set explicitly in production',
      );
      expect(() =>
        resolveRevenueCatConfig({
          NODE_ENV: 'production',
          REVENUECAT_PROVIDER: '  ',
        }),
      ).toThrow('REVENUECAT_PROVIDER must be set explicitly in production');
    });

    it('boots in production when the provider is explicitly disabled', () => {
      expect(
        resolveRevenueCatConfig({
          NODE_ENV: 'production',
          REVENUECAT_PROVIDER: 'disabled',
        }),
      ).toEqual({ provider: 'disabled' });
    });

    it('rejects sandbox purchases in production, with an allow-list of testers', () => {
      const config = resolveRevenueCatConfig({
        ...enabled(),
        NODE_ENV: 'production',
        REVENUECAT_SANDBOX_USER_IDS: ` ${TESTER.toUpperCase()} , `,
      });
      expect(config).toMatchObject({
        rejectSandbox: true,
        sandboxAllowedUserIds: new Set([TESTER]),
      });
    });

    it('accepts sandbox purchases outside production', () => {
      expect(
        resolveRevenueCatConfig({ ...enabled(), NODE_ENV: 'development' }),
      ).toMatchObject({ rejectSandbox: false });
    });

    it('fails boot on a malformed tester id', () => {
      expect(() => parseSandboxUserIds('not-a-uuid')).toThrow(
        'REVENUECAT_SANDBOX_USER_IDS',
      );
      expect(parseSandboxUserIds(undefined)).toEqual(new Set());
    });

    it('describes the mode without any secret', () => {
      const text = describeRevenueCatMode(
        resolveRevenueCatConfig({ ...enabled(), NODE_ENV: 'production' }),
      );
      expect(text).toBe(
        'revenuecat, entitlement appfitness_pro, sandbox purchases rejected (0 tester account(s) allowed)',
      );
      expect(text).not.toContain('sk_secret');
      expect(describeRevenueCatMode({ provider: 'disabled' })).toBe(
        'disabled (paid writes not enforced)',
      );
    });
  });
});
