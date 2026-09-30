import { Platform } from 'react-native';

import { getSessionSnapshot, isSessionCurrent, subscribe } from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import {
  SubscriptionPurchases,
  SubscriptionUnavailableError,
} from './application/subscription-purchases';
import type { PurchaseAccessSnapshot } from './domain/purchases.port';
import { resolveSubscriptionProviderConfig } from './infrastructure/revenuecat-config';
import { RevenueCatPurchasesAdapter } from './infrastructure/revenuecat-purchases.adapter';

let runtime: SubscriptionPurchases | null = null;
let initialized = false;

export function initializeSubscriptionPurchases(): void {
  if (initialized) return;
  initialized = true;

  let config;
  try {
    config = resolveSubscriptionProviderConfig(Platform.OS);
  } catch (error) {
    logError('subscriptions.configuration', error);
    return;
  }

  runtime = new SubscriptionPurchases(
    new RevenueCatPurchasesAdapter(),
    config,
    { getSessionSnapshot, isSessionCurrent, subscribe },
    logError,
  );
  runtime.start();
}

/** Reserved for the user-initiated restore action in S-3. */
export async function restoreSubscriptionPurchases(): Promise<PurchaseAccessSnapshot> {
  if (!initialized) initializeSubscriptionPurchases();
  if (!runtime) throw new SubscriptionUnavailableError();
  return runtime.restorePurchases();
}
