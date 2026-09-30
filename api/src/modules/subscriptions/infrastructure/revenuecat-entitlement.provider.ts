import { Inject, Injectable } from '@nestjs/common';

import {
  REVENUECAT_CONFIG,
  type EnabledRevenueCatConfig,
} from '../../../config/revenuecat.config';
import type {
  EntitlementProvider,
  ProviderEntitlementSnapshot,
} from '../domain/subscription.types';

export const REVENUECAT_FETCH = Symbol('REVENUECAT_FETCH');
export type RevenueCatFetch = typeof fetch;

const API_BASE = 'https://api.revenuecat.com/v1/subscribers';
const REQUEST_TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('Malformed provider date');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Malformed provider date');
  return date;
}

function providerUrl(userId: string): string {
  return `${API_BASE}/${encodeURIComponent(userId)}`;
}

@Injectable()
export class RevenueCatEntitlementProvider implements EntitlementProvider {
  readonly enabled = true;

  constructor(
    @Inject(REVENUECAT_CONFIG)
    private readonly config: EnabledRevenueCatConfig,
    @Inject(REVENUECAT_FETCH) private readonly fetchImpl: RevenueCatFetch,
  ) {}

  async getEntitlement(userId: string): Promise<ProviderEntitlementSnapshot> {
    const response = await this.request(providerUrl(userId), { method: 'GET' });
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`RevenueCat customer lookup failed (${response.status})`);
    }

    const body: unknown = await response.json();
    const subscriber = record(record(body)?.subscriber);
    if (!subscriber) throw new Error('Malformed RevenueCat customer response');

    const entitlements = record(subscriber.entitlements);
    const entitlement = record(entitlements?.[this.config.entitlementId]);
    if (!entitlement) return this.inactiveSnapshot();

    const expiresAt = nullableDate(entitlement.expires_date);
    const gracePeriodExpiresAt = nullableDate(
      entitlement.grace_period_expires_date,
    );
    const effectiveExpiry =
      gracePeriodExpiresAt &&
      (!expiresAt || gracePeriodExpiresAt.getTime() > expiresAt.getTime())
        ? gracePeriodExpiresAt
        : expiresAt;
    const isActive =
      effectiveExpiry === null || effectiveExpiry.getTime() > Date.now();

    const productId = nullableString(entitlement.product_identifier);
    const subscriptions = record(subscriber.subscriptions);
    const subscription = productId ? record(subscriptions?.[productId]) : null;
    const refundedAt = nullableDate(subscription?.refunded_at);
    const unsubscribeDetectedAt = nullableDate(
      subscription?.unsubscribe_detected_at,
    );

    return {
      entitlementId: this.config.entitlementId,
      isActive: isActive && refundedAt === null,
      expiresAt: effectiveExpiry,
      periodType: nullableString(subscription?.period_type),
      productId,
      store: nullableString(subscription?.store),
      environment:
        typeof subscription?.is_sandbox === 'boolean'
          ? subscription.is_sandbox
            ? 'SANDBOX'
            : 'PRODUCTION'
          : null,
      willRenew:
        subscription === null
          ? null
          : unsubscribeDetectedAt === null && refundedAt === null,
    };
  }

  async ensureCustomerDeleted(userId: string): Promise<void> {
    const response = await this.request(providerUrl(userId), {
      method: 'DELETE',
    });
    // RevenueCat documents both outcomes as retry-safe completion.
    if (response.status !== 200 && response.status !== 404) {
      throw new Error(
        `RevenueCat customer deletion failed (${response.status})`,
      );
    }
  }

  private inactiveSnapshot(): ProviderEntitlementSnapshot {
    return {
      entitlementId: this.config.entitlementId,
      isActive: false,
      expiresAt: null,
      periodType: null,
      productId: null,
      store: null,
      environment: null,
      willRenew: null,
    };
  }

  private request(url: string, init: RequestInit): Promise<Response> {
    return this.fetchImpl(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.secretApiKey}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }
}
