import { HttpException, HttpStatus } from '@nestjs/common';

import type { RevenueCatConfig } from '../../../config/revenuecat.config';
import type { PrismaService } from '../../database/prisma.service';
import {
  EntitlementAuthorizationService,
  SUBSCRIPTION_REQUIRED_CODE,
} from './entitlement-authorization.service';

const USER_ID = '00000000-0000-4000-8000-00000000aaaa';
const ENTITLEMENT = 'appfitness_pro';
const FUTURE = new Date('2026-10-01T00:00:00.001Z');

describe('EntitlementAuthorizationService', () => {
  const findUnique = jest.fn();
  const prisma = {
    subscriptionEntitlement: { findUnique },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps paid-write enforcement dormant while the provider is disabled', async () => {
    const service = new EntitlementAuthorizationService(prisma, {
      provider: 'disabled',
    });

    await expect(
      service.assertPaidMutationAllowed(USER_ID),
    ).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    [
      'inactive',
      { entitlementId: ENTITLEMENT, isActive: false, expiresAt: null },
    ],
    [
      'expired',
      {
        entitlementId: ENTITLEMENT,
        isActive: true,
        expiresAt: new Date('2026-09-30T23:59:59.000Z'),
      },
    ],
    // An active, unexpired mirror for a different entitlement never authorizes.
    [
      'foreign-entitlement',
      {
        entitlementId: 'some_other_entitlement',
        isActive: true,
        expiresAt: FUTURE,
      },
    ],
    [
      'foreign-entitlement non-expiring',
      {
        entitlementId: 'some_other_entitlement',
        isActive: true,
        expiresAt: null,
      },
    ],
  ])(
    'fails closed for an enabled provider with a %s mirror',
    async (_label, row) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
      findUnique.mockResolvedValue(row);
      const service = new EntitlementAuthorizationService(
        prisma,
        enabledConfig(),
      );

      const failure: unknown = await service
        .assertPaidMutationAllowed(USER_ID)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(HttpException);
      const refusal = failure as HttpException;
      expect(refusal.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(refusal.getResponse()).toMatchObject({
        code: SUBSCRIPTION_REQUIRED_CODE,
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { entitlementId: true, isActive: true, expiresAt: true },
      });
      jest.useRealTimers();
    },
  );

  it.each([
    { entitlementId: ENTITLEMENT, isActive: true, expiresAt: null },
    { entitlementId: ENTITLEMENT, isActive: true, expiresAt: FUTURE },
  ])('allows a currently active server mirror', async (row) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    findUnique.mockResolvedValue(row);
    const service = new EntitlementAuthorizationService(
      prisma,
      enabledConfig(),
    );

    await expect(
      service.assertPaidMutationAllowed(USER_ID),
    ).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});

function enabledConfig(): RevenueCatConfig {
  return {
    provider: 'revenuecat',
    secretApiKey: 'secret',
    webhookAuthToken: 'a'.repeat(32),
    webhookSigningSecret: 'b'.repeat(32),
    entitlementId: ENTITLEMENT,
  };
}
