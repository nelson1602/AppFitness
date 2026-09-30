import { UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { EnabledRevenueCatConfig } from '../../../config/revenuecat.config';

const SIGNATURE_PATTERN = /^t=(\d+),v1=([a-f0-9]{64})$/i;
const MAX_SIGNATURE_AGE_SECONDS = 300;

function fixedLengthDigest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function equalSecret(left: string, right: string): boolean {
  return timingSafeEqual(fixedLengthDigest(left), fixedLengthDigest(right));
}

/** Verifies both configured webhook credentials before payload parsing. */
export function verifyRevenueCatWebhook(
  config: EnabledRevenueCatConfig,
  authorization: string | undefined,
  signature: string | undefined,
  rawBody: Buffer | undefined,
  nowMs: number = Date.now(),
): void {
  const expectedAuthorization = config.webhookAuthToken;
  if (
    !authorization ||
    !equalSecret(authorization, expectedAuthorization) ||
    !signature ||
    !rawBody
  ) {
    throw new UnauthorizedException('Invalid webhook credentials');
  }

  const match = SIGNATURE_PATTERN.exec(signature);
  if (!match) throw new UnauthorizedException('Invalid webhook credentials');

  const timestamp = Number(match[1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(nowMs / 1000) - timestamp) > MAX_SIGNATURE_AGE_SECONDS
  ) {
    throw new UnauthorizedException('Invalid webhook credentials');
  }

  const expected = createHmac('sha256', config.webhookSigningSecret)
    .update(Buffer.from(`${timestamp}.`, 'utf8'))
    .update(rawBody)
    .digest();
  const received = Buffer.from(match[2], 'hex');
  if (!timingSafeEqual(expected, received)) {
    throw new UnauthorizedException('Invalid webhook credentials');
  }
}
