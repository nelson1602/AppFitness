import { useSyncExternalStore } from 'react';

import {
  getEntitlementAccess,
  subscribeEntitlementAccess,
  type EntitlementAccessSnapshot,
} from './entitlement-access';

export function useEntitlementAccess(): EntitlementAccessSnapshot {
  return useSyncExternalStore(
    subscribeEntitlementAccess,
    getEntitlementAccess,
    getEntitlementAccess,
  );
}
