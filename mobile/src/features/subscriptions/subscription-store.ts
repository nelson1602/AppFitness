import { Platform } from 'react-native';
import { useStore } from 'zustand';

import {
  bindStoreToSession,
  getSessionSnapshot,
  isSessionCurrent,
} from '@/features/authentication';
import { logError } from '@/shared/infrastructure/logging';

import { createSubscriptionStore, type SubscriptionState } from './application/subscription.store';
import {
  getSubscriptionAvailability,
  loadSubscriptionAccess,
  loadSubscriptionOffer,
  openSubscriptionManagement,
  purchaseSubscriptionOffer,
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
  },
  { getSessionSnapshot, isSessionCurrent },
  logError,
);

bindStoreToSession(() => subscriptionStore.getState().reset());

export function useSubscriptionStore<T>(selector: (state: SubscriptionState) => T): T {
  return useStore(subscriptionStore, selector);
}
