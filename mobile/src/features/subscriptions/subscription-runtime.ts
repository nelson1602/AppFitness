import { Linking, Platform } from 'react-native';

import {
  getSessionSnapshot,
  isSessionCurrent,
  refreshTokens,
  requireSessionSnapshot,
  subscribe,
} from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import {
  SubscriptionPurchases,
  SubscriptionUnavailableError,
} from './application/subscription-purchases';
import type {
  PurchaseAccessSnapshot,
  PurchaseOutcome,
  SubscriptionOffer,
  SubscriptionOfferHandle,
} from './domain/purchases.port';
import { resolveSubscriptionProviderConfig } from './infrastructure/revenuecat-config';
import { RevenueCatPurchasesAdapter } from './infrastructure/revenuecat-purchases.adapter';

let runtime: SubscriptionPurchases | null = null;
let initialized = false;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export class SubscriptionReconciliationError extends Error {
  constructor() {
    super('The server entitlement mirror could not be reconciled');
    this.name = 'SubscriptionReconciliationError';
  }
}

/**
 * Where purchasing stands on this build. `web` is the ADR-P019 declared
 * platform boundary; `unconfigured` covers a native build without a valid
 * public key (or an unsupported platform) and is never retried.
 */
export type SubscriptionAvailability = 'web' | 'unconfigured' | 'available';

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
    new RevenueCatPurchasesAdapter(
      undefined,
      Platform.OS === 'android' ? 'android' : 'ios',
      (url) => Linking.openURL(url),
    ),
    config,
    { getSessionSnapshot, isSessionCurrent, subscribe },
    logError,
  );
  runtime.start();
}

function requireRuntime(): SubscriptionPurchases {
  if (!initialized) initializeSubscriptionPurchases();
  if (!runtime) throw new SubscriptionUnavailableError();
  return runtime;
}

export function getSubscriptionAvailability(): SubscriptionAvailability {
  if (Platform.OS === 'web') return 'web';
  if (!initialized) initializeSubscriptionPurchases();
  return runtime?.isAvailable ? 'available' : 'unconfigured';
}

/** The user-initiated restore action. */
export async function restoreSubscriptionPurchases(): Promise<PurchaseAccessSnapshot> {
  return requireRuntime().restorePurchases();
}

export async function loadSubscriptionAccess(): Promise<PurchaseAccessSnapshot> {
  return requireRuntime().getAccess();
}

export async function loadSubscriptionOffer(): Promise<SubscriptionOffer | null> {
  return requireRuntime().loadOffer();
}

export async function purchaseSubscriptionOffer(
  handle: SubscriptionOfferHandle,
): Promise<PurchaseOutcome> {
  return requireRuntime().purchase(handle);
}

export async function openSubscriptionManagement(): Promise<void> {
  return requireRuntime().openManagement();
}

/**
 * Refreshes the server's independent entitlement mirror after native SDK
 * evidence becomes active. It sends no receipt or provider payload.
 */
export async function reconcileServerSubscription(): Promise<void> {
  let owner = requireSessionSnapshot();
  let response: Response;
  try {
    response = await requestReconciliation(owner.accessToken);
    if (response.status === 401 && isSessionCurrent(owner)) {
      const rotated = await refreshTokens();
      if (!rotated || rotated.user.id !== owner.userId) throw new SubscriptionReconciliationError();
      owner = requireSessionSnapshot();
      response = await requestReconciliation(rotated.accessToken);
    }
  } catch {
    throw new SubscriptionReconciliationError();
  }
  if (!isSessionCurrent(owner) || !response.ok) throw new SubscriptionReconciliationError();
}

function requestReconciliation(accessToken: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/subscriptions/reconcile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
