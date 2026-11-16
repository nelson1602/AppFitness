import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  REVENUECAT_CONFIG,
  type RevenueCatConfig,
} from '../../../config/revenuecat.config';
import { PrismaService } from '../../database/prisma.service';
import { entitlementGrantsAccess } from '../domain/entitlement-access';

export const SUBSCRIPTION_REQUIRED_CODE = 'SUBSCRIPTION_REQUIRED';

/**
 * Server-authoritative paid-write boundary (ADR-P034 Decision 5 / S-4).
 *
 * Enforcement is dormant while RevenueCat is deliberately disabled. Once an
 * environment enables the provider, only the durable entitlement mirror can
 * authorize a protected mutation; a client claim is never consulted.
 */
@Injectable()
export class EntitlementAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REVENUECAT_CONFIG)
    private readonly config: RevenueCatConfig,
  ) {}

  async assertPaidMutationAllowed(userId: string): Promise<void> {
    if (this.config.provider === 'disabled') return;

    const entitlement = await this.prisma.subscriptionEntitlement.findUnique({
      where: { userId },
      select: {
        entitlementId: true,
        isActive: true,
        expiresAt: true,
        environment: true,
      },
    });
    // The mirror must be for the entitlement this environment sells; an active
    // row for any other entitlement identifier never authorizes a paid write.
    // ADR-P046: nor does a sandbox purchase in production (testers aside).
    if (!entitlementGrantsAccess(entitlement, this.config, userId)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          code: SUBSCRIPTION_REQUIRED_CODE,
          message: 'An active subscription is required for this operation',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
