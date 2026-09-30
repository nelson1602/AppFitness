import { Module } from '@nestjs/common';

import {
  REVENUECAT_CONFIG,
  resolveRevenueCatConfig,
  type RevenueCatConfig,
} from '../../config/revenuecat.config';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { SubscriptionService } from './application/subscription.service';
import { ENTITLEMENT_PROVIDER } from './domain/subscription.types';
import { DisabledEntitlementProvider } from './infrastructure/disabled-entitlement.provider';
import {
  REVENUECAT_FETCH,
  RevenueCatEntitlementProvider,
  type RevenueCatFetch,
} from './infrastructure/revenuecat-entitlement.provider';
import { SubscriptionController } from './presentation/subscription.controller';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [SubscriptionController],
  providers: [
    {
      provide: REVENUECAT_CONFIG,
      useFactory: (): RevenueCatConfig => resolveRevenueCatConfig(),
    },
    {
      provide: REVENUECAT_FETCH,
      useValue: globalThis.fetch.bind(globalThis),
    },
    {
      provide: ENTITLEMENT_PROVIDER,
      inject: [REVENUECAT_CONFIG, REVENUECAT_FETCH],
      useFactory: (config: RevenueCatConfig, fetchImpl: RevenueCatFetch) =>
        config.provider === 'revenuecat'
          ? new RevenueCatEntitlementProvider(config, fetchImpl)
          : new DisabledEntitlementProvider(),
    },
    SubscriptionService,
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
