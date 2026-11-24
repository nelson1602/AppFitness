import { Injectable } from '@nestjs/common';

import {
  type EntitlementProvider,
  type ProviderEntitlementSnapshot,
  SubscriptionProviderUnavailableError,
} from '../domain/subscription.types';

@Injectable()
export class DisabledEntitlementProvider implements EntitlementProvider {
  readonly enabled = false;

  getEntitlement(): Promise<ProviderEntitlementSnapshot> {
    return Promise.reject(new SubscriptionProviderUnavailableError());
  }

  // No provider is configured, so there is no external customer to delete.
  ensureCustomerDeleted(): Promise<void> {
    return Promise.resolve();
  }

  grantPromotional(): Promise<void> {
    return Promise.reject(new SubscriptionProviderUnavailableError());
  }

  revokePromotionals(): Promise<void> {
    return Promise.reject(new SubscriptionProviderUnavailableError());
  }
}
