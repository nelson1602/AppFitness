import { Platform } from 'react-native';
import { useStore } from 'zustand';

import {
  bindStoreToSession,
  getSessionSnapshot,
  isSessionCurrent,
} from '@/features/authentication';
import {
  beginEntitlementCheck,
  configureEntitlementEnforcement,
  resetEntitlementAccess,
  setEntitlementAccess,
} from '@/shared/application/entitlement-access';
import { logError } from '@/shared/infrastructure/logging';

import { createSubscriptionStore, type SubscriptionState } from './application/subscription.store';
import {
  getSubscriptionAvailability,
  loadSubscriptionAccess,
  loadSubscriptionOffer,
  openSubscriptionManagement,
  purchaseSubscriptionOffer,
  reconcileServerSubscription,
  restoreSubscriptionPurchases,
} from './subscription-runtime';

/**
 * Composition of the S-3 store: the runtime is the only gateway, and the store
 * is reset synchronously whenever the owning account changes (ADR-P030 C-1),
 * so account B never sees account A's offer, access or pending operation.
 */
export const subscriptionStore = createSubscriptionStore(
  {
    availability: getSubscriptionAvailability,
    storeKind: () => (Platform.OS === 'android' ? 'google' : 'apple'),
    loadAccess: loadSubscriptionAccess,
    loadOffer: loadSubscriptionOffer,
    purchase: purchaseSubscriptionOffer,
    restore: restoreSubscriptionPurchases,
    manage: openSubscriptionManagement,
    reconcileServer: reconcileServerSubscription,
  },
  { getSessionSnapshot, isSessionCurrent },
  logError,
  {
    configure: configureEntitlementEnforcement,
    begin: beginEntitlementCheck,
    set: setEntitlementAccess,
    reset: resetEntitlementAccess,
  },
);

bindStoreToSession(() => {
  subscriptionStore.getState().reset();
  if (getSessionSnapshot()) void subscriptionStore.getState().load();
});

let accessEnforcementInitialized = false;

/**
 * Starts the session-wide entitlement read independently of visiting the
 * subscription screen. A configured build fails closed during this first read;
 * an unconfigured/Web build remains deliberately unregulated.
 */
export function initializeSubscriptionAccessEnforcement(): void {
  if (accessEnforcementInitialized) return;
  accessEnforcementInitialized = true;
  const available = getSubscriptionAvailability() === 'available';
  configureEntitlementEnforcement(available);
  if (available && getSessionSnapshot()) void subscriptionStore.getState().load();
}

export function useSubscriptionStore<T>(selector: (state: SubscriptionState) => T): T {
  return useStore(subscriptionStore, selector);
}
