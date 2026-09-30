import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SubscriptionWebhookStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import type {
  EntitlementProvider,
  ProviderEntitlementSnapshot,
} from '../domain/subscription.types';
import {
  SubscriptionService,
  parseRevenueCatEvent,
} from './subscription.service';

const USER_ID = '00000000-0000-4000-8000-00000000aaaa';
const OTHER_USER_ID = '00000000-0000-4000-8000-00000000bbbb';
const EVENT_TIME = new Date('2026-09-29T16:00:00.000Z');

const activeSnapshot = (): ProviderEntitlementSnapshot => ({
  entitlementId: 'appfitness_pro',
  isActive: true,
  expiresAt: new Date('2026-10-29T16:00:00.000Z'),
  periodType: 'trial',
  productId: 'appfitness_pro_monthly',
  store: 'play_store',
  environment: 'SANDBOX',
  willRenew: true,
});

interface EntitlementRow extends ProviderEntitlementSnapshot {
  userId: string;
  lastProviderEventAt: Date | null;
  lastReconciledAt: Date;
}

interface EventRow {
  id: string;
  payloadHash: string;
  status: SubscriptionWebhookStatus;
  attemptCount: number;
  userId: string | null;
}

describe('parseRevenueCatEvent', () => {
  it('extracts stable routing fields, destination ids and UUID aliases only', () => {
    expect(
      parseRevenueCatEvent({
        api_version: '1.0',
        event: {
          id: 'event-1',
          type: 'RENEWAL',
          event_timestamp_ms: EVENT_TIME.getTime(),
          environment: 'PRODUCTION',
          app_user_id: USER_ID.toUpperCase(),
          original_app_user_id: '$RCAnonymousID:secret',
          aliases: [USER_ID, OTHER_USER_ID, 'not-a-uuid'],
          unexpected_future_field: true,
        },
      }),
    ).toEqual({
      id: 'event-1',
      type: 'RENEWAL',
      isTransfer: false,
      transferDestinationUserIds: [],
      timestamp: EVENT_TIME,
      environment: 'PRODUCTION',
      candidateUserIds: [USER_ID, OTHER_USER_ID],
    });
  });

  it('routes a transfer from both source and destination ids', () => {
    expect(
      parseRevenueCatEvent({
        api_version: '1.0',
        event: {
          id: 'transfer-1',
          type: 'TRANSFER',
          event_timestamp_ms: EVENT_TIME.getTime(),
          environment: 'PRODUCTION',
          transferred_from: [USER_ID],
          transferred_to: [OTHER_USER_ID],
        },
      }),
    ).toEqual({
      id: 'transfer-1',
      type: 'TRANSFER',
      isTransfer: true,
      transferDestinationUserIds: [OTHER_USER_ID],
      timestamp: EVENT_TIME,
      environment: 'PRODUCTION',
      candidateUserIds: [USER_ID, OTHER_USER_ID],
    });
  });

  it.each([
    null,
    {},
    { event: {} },
    { event: { id: 'id', type: 'TYPE', event_timestamp_ms: -1 } },
    { event: { id: 'id', type: 'TYPE', event_timestamp_ms: 'not-number' } },
  ])('rejects a malformed payload', (body) => {
    expect(() => parseRevenueCatEvent(body)).toThrow(BadRequestException);
  });
});

describe('SubscriptionService', () => {
  let entitlementRow: EntitlementRow | null;
  let eventRows: Map<string, EventRow>;
  let matchedUsers: Array<{ id: string }>;
  let prisma: {
    subscriptionEntitlement: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
    subscriptionWebhookEvent: {
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let provider: jest.Mocked<EntitlementProvider>;
  let service: SubscriptionService;

  beforeEach(() => {
    entitlementRow = null;
    eventRows = new Map();
    matchedUsers = [{ id: USER_ID }];

    prisma = {
      subscriptionEntitlement: {
        findUnique: jest.fn(() => Promise.resolve(entitlementRow)),
        upsert: jest.fn(
          (args: {
            create: EntitlementRow;
            update: Partial<EntitlementRow>;
          }) => {
            entitlementRow = entitlementRow
              ? { ...entitlementRow, ...args.update }
              : { ...args.create };
            return Promise.resolve(entitlementRow);
          },
        ),
        updateMany: jest.fn(
          (args: {
            where: {
              userId: string;
              OR: Array<
                | { lastProviderEventAt: null }
                | { lastProviderEventAt: { lt: Date } }
              >;
            };
            data: { lastProviderEventAt: Date };
          }) => {
            if (
              !entitlementRow ||
              entitlementRow.userId !== args.where.userId
            ) {
              return Promise.resolve({ count: 0 });
            }
            const current = entitlementRow.lastProviderEventAt;
            if (
              current === null ||
              current.getTime() < args.data.lastProviderEventAt.getTime()
            ) {
              entitlementRow = { ...entitlementRow, ...args.data };
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
          },
        ),
      },
      subscriptionWebhookEvent: {
        create: jest.fn((args: { data: EventRow }) => {
          if (eventRows.has(args.data.id)) {
            return Promise.reject(
              Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
            );
          }
          eventRows.set(args.data.id, {
            ...args.data,
            status: SubscriptionWebhookStatus.RECEIVED,
            userId: null,
          });
          return Promise.resolve(args.data);
        }),
        findUniqueOrThrow: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(eventRows.get(args.where.id)),
        ),
        update: jest.fn(
          (args: {
            where: { id: string };
            data: Omit<Partial<EventRow>, 'attemptCount'> & {
              attemptCount?: number | { increment: number };
            };
          }) => {
            const current = eventRows.get(args.where.id) as EventRow;
            const increment =
              typeof args.data.attemptCount === 'object'
                ? args.data.attemptCount.increment
                : 0;
            const next: EventRow = {
              ...current,
              ...args.data,
              attemptCount: current.attemptCount + increment,
            };
            eventRows.set(args.where.id, next);
            return Promise.resolve(next);
          },
        ),
        updateMany: jest.fn(
          (args: {
            where: { id: string; status?: { in: SubscriptionWebhookStatus[] } };
            data: Partial<EventRow>;
          }) => {
            const current = eventRows.get(args.where.id);
            if (
              !current ||
              (args.where.status &&
                !args.where.status.in.includes(current.status))
            ) {
              return Promise.resolve({ count: 0 });
            }
            eventRows.set(args.where.id, { ...current, ...args.data });
            return Promise.resolve({ count: 1 });
          },
        ),
      },
      user: {
        findMany: jest.fn(() => Promise.resolve(matchedUsers)),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    provider = {
      enabled: true,
      getEntitlement: jest.fn().mockResolvedValue(activeSnapshot()),
      ensureCustomerDeleted: jest.fn().mockResolvedValue(undefined),
    };
    service = new SubscriptionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      provider,
    );
  });

  const event = () => ({
    id: 'event-1',
    type: 'INITIAL_PURCHASE',
    isTransfer: false,
    transferDestinationUserIds: [],
    timestamp: EVENT_TIME,
    environment: 'SANDBOX',
    candidateUserIds: [USER_ID],
  });

  it('reports UNKNOWN with no mirror, then ACTIVE only before its expiry', async () => {
    await expect(service.getStatus(USER_ID)).resolves.toEqual(
      expect.objectContaining({ state: 'UNKNOWN', lastReconciledAt: null }),
    );

    entitlementRow = {
      ...activeSnapshot(),
      userId: USER_ID,
      lastProviderEventAt: null,
      lastReconciledAt: EVENT_TIME,
    };
    await expect(service.getStatus(USER_ID)).resolves.toEqual(
      expect.objectContaining({ state: 'ACTIVE' }),
    );
    entitlementRow.expiresAt = new Date('2020-01-01T00:00:00.000Z');
    await expect(service.getStatus(USER_ID)).resolves.toEqual(
      expect.objectContaining({ state: 'INACTIVE' }),
    );
  });

  it('reconciles from provider, persists the mirror and audits only a change', async () => {
    await expect(service.reconcile(USER_ID)).resolves.toEqual(
      expect.objectContaining({ state: 'ACTIVE', periodType: 'trial' }),
    );
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'SUBSCRIPTION_ENTITLEMENT_CHANGE',
      userId: USER_ID,
      metadata: {
        active: true,
        source: 'manual',
        environment: 'SANDBOX',
      },
    });

    audit.record.mockClear();
    await service.reconcile(USER_ID);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('fails reconciliation closed when disabled or when provider lookup fails', async () => {
    Object.defineProperty(provider, 'enabled', { value: false });
    await expect(service.reconcile(USER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(provider.getEntitlement.mock.calls).toHaveLength(0);

    Object.defineProperty(provider, 'enabled', { value: true });
    provider.getEntitlement.mockRejectedValue(new Error('provider secret'));
    await expect(service.reconcile(USER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('ingests one event, resolves the owned UUID and stores no raw payload', async () => {
    const result = await service.ingestWebhook(event(), 'a'.repeat(64));
    expect(result).toEqual({
      accepted: true,
      duplicate: false,
      outcome: 'PROCESSED',
    });
    expect(provider.getEntitlement.mock.calls).toContainEqual([USER_ID]);
    expect(entitlementRow).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        lastProviderEventAt: EVENT_TIME,
      }),
    );
    expect(eventRows.get('event-1')).toEqual(
      expect.objectContaining({
        status: SubscriptionWebhookStatus.PROCESSED,
        userId: USER_ID,
      }),
    );
    expect(prisma.subscriptionWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        id: 'event-1',
        eventType: 'INITIAL_PURCHASE',
        eventTimestamp: EVENT_TIME,
        environment: 'SANDBOX',
        payloadHash: 'a'.repeat(64),
        attemptCount: 1,
      },
    });
  });

  it('answers a completed duplicate without another provider call or audit', async () => {
    await service.ingestWebhook(event(), 'a'.repeat(64));
    provider.getEntitlement.mockClear();
    audit.record.mockClear();

    await expect(
      service.ingestWebhook(event(), 'a'.repeat(64)),
    ).resolves.toEqual({
      accepted: true,
      duplicate: true,
      outcome: 'PROCESSED',
    });
    expect(provider.getEntitlement.mock.calls).toHaveLength(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects one event id reused with different bytes', async () => {
    await service.ingestWebhook(event(), 'a'.repeat(64));
    await expect(
      service.ingestWebhook(event(), 'b'.repeat(64)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['no owned id', []],
    ['aliases spanning two accounts', [{ id: USER_ID }, { id: OTHER_USER_ID }]],
  ])('ignores %s without calling the provider', async (_name, users) => {
    matchedUsers = users;
    const result = await service.ingestWebhook(event(), 'a'.repeat(64));
    expect(result.outcome).toBe('IGNORED');
    expect(provider.getEntitlement.mock.calls).toHaveLength(0);
    expect(eventRows.get('event-1')?.status).toBe(
      SubscriptionWebhookStatus.IGNORED,
    );
  });

  it('marks a failed reconciliation retryable and succeeds on the same event id later', async () => {
    provider.getEntitlement.mockRejectedValueOnce(new Error('temporary'));
    await expect(
      service.ingestWebhook(event(), 'a'.repeat(64)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(eventRows.get('event-1')).toEqual(
      expect.objectContaining({
        status: SubscriptionWebhookStatus.FAILED,
        attemptCount: 1,
      }),
    );

    await expect(
      service.ingestWebhook(event(), 'a'.repeat(64)),
    ).resolves.toEqual(
      expect.objectContaining({ outcome: 'PROCESSED', duplicate: false }),
    );
    expect(eventRows.get('event-1')?.attemptCount).toBe(2);
  });

  it('does not move lastProviderEventAt backwards for an out-of-order event', async () => {
    entitlementRow = {
      ...activeSnapshot(),
      userId: USER_ID,
      lastProviderEventAt: new Date('2026-10-01T00:00:00.000Z'),
      lastReconciledAt: EVENT_TIME,
    };
    await service.ingestWebhook(event(), 'a'.repeat(64));
    expect(entitlementRow.lastProviderEventAt).toEqual(
      new Date('2026-10-01T00:00:00.000Z'),
    );
  });

  it('deletes the provider customer before local account deletion and audits no identifier', async () => {
    await service.deleteProviderCustomer(USER_ID);
    expect(provider.ensureCustomerDeleted.mock.calls).toContainEqual([USER_ID]);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'SUBSCRIPTION_PROVIDER_DELETE',
      userId: USER_ID,
    });

    Object.defineProperty(provider, 'enabled', { value: false });
    audit.record.mockClear();
    await service.deleteProviderCustomer(USER_ID);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
