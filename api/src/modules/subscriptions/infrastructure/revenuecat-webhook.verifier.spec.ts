import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import type { EnabledRevenueCatConfig } from '../../../config/revenuecat.config';
import { verifyRevenueCatWebhook } from './revenuecat-webhook.verifier';

const config: EnabledRevenueCatConfig = {
  provider: 'revenuecat',
  secretApiKey: 'secret-api-key',
  webhookAuthToken: 'a'.repeat(32),
  webhookSigningSecret: 'b'.repeat(32),
  entitlementId: 'appfitness_pro',
};

const nowMs = Date.parse('2026-09-29T16:00:00.000Z');
const timestamp = Math.floor(nowMs / 1000);
const rawBody = Buffer.from('{"event":{"id":"event-1"}}', 'utf8');

function signature(body: Buffer = rawBody, t: number = timestamp): string {
  const digest = createHmac('sha256', config.webhookSigningSecret)
    .update(Buffer.from(`${t}.`, 'utf8'))
    .update(body)
    .digest('hex');
  return `t=${t},v1=${digest}`;
}

describe('verifyRevenueCatWebhook', () => {
  it('accepts the exact authorization value, fresh timestamp and raw-body HMAC', () => {
    expect(() =>
      verifyRevenueCatWebhook(
        config,
        config.webhookAuthToken,
        signature(),
        rawBody,
        nowMs,
      ),
    ).not.toThrow();
  });

  it.each([
    ['missing authorization', undefined, signature(), rawBody],
    ['wrong authorization', 'Bearer wrong', signature(), rawBody],
    ['missing signature', config.webhookAuthToken, undefined, rawBody],
    ['missing raw body', config.webhookAuthToken, signature(), undefined],
    [
      'malformed signature',
      config.webhookAuthToken,
      'v1=no-timestamp',
      rawBody,
    ],
  ])('rejects %s with one generic 401', (_name, auth, sig, body) => {
    expect(() =>
      verifyRevenueCatWebhook(config, auth, sig, body, nowMs),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a stale or future timestamp outside the five-minute window', () => {
    for (const delta of [-301, 301]) {
      const t = timestamp + delta;
      expect(() =>
        verifyRevenueCatWebhook(
          config,
          config.webhookAuthToken,
          signature(rawBody, t),
          rawBody,
          nowMs,
        ),
      ).toThrow(UnauthorizedException);
    }
  });

  it('rejects a signature computed for different bytes', () => {
    expect(() =>
      verifyRevenueCatWebhook(
        config,
        config.webhookAuthToken,
        signature(Buffer.from('{}')),
        rawBody,
        nowMs,
      ),
    ).toThrow(UnauthorizedException);
  });
});
