/**
 * RevenueCat server configuration (ADR-P034 / FEATURE-012 S-1).
 *
 * Disabled is the safe default so merging the infrastructure cannot make an
 * unconfigured environment call a provider or accept a webhook. Once enabled,
 * every secret and the immutable entitlement identifier is mandatory and boot
 * fails closed on an incomplete configuration.
 */

export const REVENUECAT_PROVIDERS = ['disabled', 'revenuecat'] as const;
export type RevenueCatProvider = (typeof REVENUECAT_PROVIDERS)[number];

export const REVENUECAT_CONFIG = Symbol('REVENUECAT_CONFIG');

export interface DisabledRevenueCatConfig {
  provider: 'disabled';
}

export interface EnabledRevenueCatConfig {
  provider: 'revenuecat';
  /** Secret server API key. Never log, return or place in a mobile bundle. */
  secretApiKey: string;
  /** Exact shared Authorization value configured on the webhook integration. */
  webhookAuthToken: string;
  /** HMAC signing secret shown once by RevenueCat. */
  webhookSigningSecret: string;
  /** Stable lookup identifier, e.g. `appfitness_pro`. */
  entitlementId: string;
}

export type RevenueCatConfig =
  DisabledRevenueCatConfig | EnabledRevenueCatConfig;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,255}$/;
const MIN_LOCAL_SECRET_LENGTH = 32;

function requireValue(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim();
  if (value === '') {
    throw new Error(`${name} is required when REVENUECAT_PROVIDER is enabled`);
  }
  return value;
}

function requireLocalSecret(raw: string | undefined, name: string): string {
  const value = requireValue(raw, name);
  if (value.length < MIN_LOCAL_SECRET_LENGTH) {
    throw new Error(`${name} must contain at least 32 characters`);
  }
  return value;
}

export function resolveRevenueCatConfig(
  env: NodeJS.ProcessEnv = process.env,
): RevenueCatConfig {
  const provider = (env.REVENUECAT_PROVIDER ?? '').trim().toLowerCase();

  if (provider === '' || provider === 'disabled') {
    return { provider: 'disabled' };
  }
  if (provider !== 'revenuecat') {
    throw new Error(
      `Unsupported REVENUECAT_PROVIDER: "${provider}". Supported values: ${REVENUECAT_PROVIDERS.join(', ')}.`,
    );
  }

  const entitlementId = requireValue(
    env.REVENUECAT_ENTITLEMENT_ID,
    'REVENUECAT_ENTITLEMENT_ID',
  );
  if (!IDENTIFIER_PATTERN.test(entitlementId)) {
    throw new Error(
      'REVENUECAT_ENTITLEMENT_ID must be 1-255 letters, digits, dot, underscore or hyphen characters',
    );
  }

  return {
    provider: 'revenuecat',
    secretApiKey: requireValue(
      env.REVENUECAT_SECRET_API_KEY,
      'REVENUECAT_SECRET_API_KEY',
    ),
    webhookAuthToken: requireLocalSecret(
      env.REVENUECAT_WEBHOOK_AUTH_TOKEN,
      'REVENUECAT_WEBHOOK_AUTH_TOKEN',
    ),
    webhookSigningSecret: requireLocalSecret(
      env.REVENUECAT_WEBHOOK_SIGNING_SECRET,
      'REVENUECAT_WEBHOOK_SIGNING_SECRET',
    ),
    entitlementId,
  };
}
