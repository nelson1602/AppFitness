import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditAction, Prisma, SubscriptionWebhookStatus } from '@prisma/client';

import {
  REVENUECAT_CONFIG,
  type RevenueCatConfig,
} from '../../../config/revenuecat.config';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ENTITLEMENT_PROVIDER,
  type EntitlementProvider,
  type ParsedRevenueCatEvent,
  type PromotionalDuration,
  type ProviderEntitlementSnapshot,
  type SubscriptionStatusView,
  type WebhookIngestionResult,
} from '../domain/subscription.types';
import { entitlementGrantsAccess } from '../domain/entitlement-access';

/**
 * ADR-P046: a reconcile within this long of the last one answers from the
 * mirror instead of calling the provider again.
 */
export const RECONCILE_MIN_INTERVAL_MS = 30_000;

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0,
      )
    : [];
}

/**
 * Narrow only the stable envelope fields needed for routing/idempotency.
 * Unknown event types and additional fields remain accepted for forward
 * compatibility; no provider payload is persisted.
 */
export function parseRevenueCatEvent(body: unknown): ParsedRevenueCatEvent {
  const envelope = record(body);
  const event = record(envelope?.event);
  const id = boundedString(event?.id, 255);
  const type = boundedString(event?.type, 80);
  const timestampMs = event?.event_timestamp_ms;

  if (
    !id ||
    !type ||
    typeof timestampMs !== 'number' ||
    !Number.isSafeInteger(timestampMs) ||
    timestampMs <= 0
  ) {
    throw new BadRequestException('Invalid webhook payload');
  }
  if (!event) {
    throw new BadRequestException('Invalid webhook payload');
  }
  const timestamp = new Date(timestampMs);
  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException('Invalid webhook payload');
  }

  const isTransfer = type === 'TRANSFER';
  const transferDestinationUserIds = new Set<string>();
  for (const candidate of stringArray(event.transferred_to)) {
    if (UUID_PATTERN.test(candidate)) {
      transferDestinationUserIds.add(candidate.toLowerCase());
    }
  }
  const candidates = isTransfer
    ? [
        ...stringArray(event.transferred_from),
        ...stringArray(event.transferred_to),
      ]
    : [
        event.app_user_id,
        event.original_app_user_id,
        ...stringArray(event.aliases),
      ];
  const candidateUserIds = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && UUID_PATTERN.test(candidate)) {
      candidateUserIds.add(candidate.toLowerCase());
    }
  }

  return {
    id,
    type,
    isTransfer,
    transferDestinationUserIds: [...transferDestinationUserIds],
    timestamp,
    environment: boundedString(event.environment, 32),
    candidateUserIds: [...candidateUserIds],
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly provider: EntitlementProvider,
    @Inject(REVENUECAT_CONFIG)
    private readonly config: RevenueCatConfig,
  ) {}

  async getStatus(userId: string): Promise<SubscriptionStatusView> {
    const row = await this.prisma.subscriptionEntitlement.findUnique({
      where: { userId },
    });
    if (!row) {
      return {
        state: 'UNKNOWN',
        expiresAt: null,
        periodType: null,
        store: null,
        willRenew: null,
        lastReconciledAt: null,
      };
    }

    // ADR-P046: the same rule as the paid-write guard when payments are on
    // (entitlement id, expiry, and no sandbox purchase in production).
    const activeNow =
      this.config.provider === 'revenuecat'
        ? entitlementGrantsAccess(row, this.config, userId)
        : row.isActive &&
          (row.expiresAt === null || row.expiresAt.getTime() > Date.now());
    return {
      state: activeNow ? 'ACTIVE' : 'INACTIVE',
      expiresAt: row.expiresAt?.toISOString() ?? null,
      periodType: row.periodType,
      store: row.store,
      willRenew: row.willRenew,
      lastReconciledAt: row.lastReconciledAt.toISOString(),
    };
  }

  async reconcile(userId: string): Promise<SubscriptionStatusView> {
    this.assertProviderEnabled();
    // ADR-P046: a reconcile right after another answers from the mirror.
    const last = await this.prisma.subscriptionEntitlement.findUnique({
      where: { userId },
      select: { lastReconciledAt: true },
    });
    if (
      last &&
      Date.now() - last.lastReconciledAt.getTime() < RECONCILE_MIN_INTERVAL_MS
    ) {
      return this.getStatus(userId);
    }
    const snapshot = await this.fetchSnapshot(userId);
    const changed = await this.persistSnapshot(
      userId,
      snapshot,
      null,
      null,
      new Date(),
    );
    if (changed) await this.auditEntitlementChange(userId, snapshot, 'manual');
    return this.getStatus(userId);
  }

  async ingestWebhook(
    event: ParsedRevenueCatEvent,
    payloadHash: string,
  ): Promise<WebhookIngestionResult> {
    this.assertProviderEnabled();
    const existing = await this.receiveEvent(event, payloadHash);
    if (
      existing?.status === SubscriptionWebhookStatus.PROCESSED ||
      existing?.status === SubscriptionWebhookStatus.IGNORED
    ) {
      return {
        accepted: true,
        duplicate: true,
        outcome:
          existing.status === SubscriptionWebhookStatus.PROCESSED
            ? 'PROCESSED'
            : 'IGNORED',
      };
    }

    const users =
      event.candidateUserIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: {
              id: { in: event.candidateUserIds },
              deletedAt: null,
            },
            select: { id: true },
          });

    // A normal event must resolve to exactly one AppFitness account. A transfer
    // intentionally names both the source and destination; reconcile every
    // owned side independently so the source cannot retain stale access.
    if (users.length === 0 || (!event.isTransfer && users.length !== 1)) {
      await this.prisma.subscriptionWebhookEvent.updateMany({
        where: {
          id: event.id,
          status: {
            in: [
              SubscriptionWebhookStatus.RECEIVED,
              SubscriptionWebhookStatus.FAILED,
            ],
          },
        },
        data: {
          status: SubscriptionWebhookStatus.IGNORED,
          failureCode:
            users.length === 0 ? 'UNKNOWN_USER' : 'AMBIGUOUS_USER_ALIASES',
          processedAt: new Date(),
        },
      });
      return { accepted: true, duplicate: false, outcome: 'IGNORED' };
    }

    let snapshots: Array<{
      userId: string;
      snapshot: ProviderEntitlementSnapshot;
      fetchedAt: Date;
    }>;
    try {
      snapshots = await Promise.all(
        users.map(async ({ id: userId }) => ({
          userId,
          snapshot: await this.provider.getEntitlement(userId),
          fetchedAt: new Date(),
        })),
      );
    } catch {
      await this.prisma.subscriptionWebhookEvent.updateMany({
        where: { id: event.id },
        data: {
          status: SubscriptionWebhookStatus.FAILED,
          failureCode: 'PROVIDER_RECONCILIATION_FAILED',
        },
      });
      throw new ServiceUnavailableException(
        'Subscription reconciliation unavailable',
      );
    }

    const result = await this.persistWebhookSnapshots(event, snapshots);
    if (!result.claimed) {
      return { accepted: true, duplicate: true, outcome: 'PROCESSED' };
    }
    for (const changed of result.changed) {
      await this.auditEntitlementChange(
        changed.userId,
        changed.snapshot,
        'webhook',
      );
    }
    return { accepted: true, duplicate: false, outcome: 'PROCESSED' };
  }

  /** Called by account deletion before the local user row becomes unreachable. */
  async deleteProviderCustomer(userId: string): Promise<void> {
    await this.provider.ensureCustomerDeleted(userId);
    if (this.provider.enabled) {
      await this.audit.record({
        action: AuditAction.SUBSCRIPTION_PROVIDER_DELETE,
        userId,
      });
    }
  }

  private assertProviderEnabled(): void {
    if (!this.provider.enabled) {
      throw new ServiceUnavailableException(
        'Subscription provider is unavailable',
      );
    }
  }

  private async fetchSnapshot(
    userId: string,
  ): Promise<ProviderEntitlementSnapshot> {
    try {
      return await this.provider.getEntitlement(userId);
    } catch {
      throw new ServiceUnavailableException(
        'Subscription reconciliation unavailable',
      );
    }
  }

  private async receiveEvent(
    event: ParsedRevenueCatEvent,
    payloadHash: string,
  ): Promise<{ status: SubscriptionWebhookStatus } | null> {
    try {
      await this.prisma.subscriptionWebhookEvent.create({
        data: {
          id: event.id,
          eventType: event.type,
          eventTimestamp: event.timestamp,
          environment: event.environment,
          payloadHash,
          attemptCount: 1,
        },
      });
      return null;
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
    }

    const existing =
      await this.prisma.subscriptionWebhookEvent.findUniqueOrThrow({
        where: { id: event.id },
        select: { payloadHash: true, status: true },
      });
    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException('Webhook event id collision');
    }
    if (
      existing.status !== SubscriptionWebhookStatus.PROCESSED &&
      existing.status !== SubscriptionWebhookStatus.IGNORED
    ) {
      await this.prisma.subscriptionWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: SubscriptionWebhookStatus.RECEIVED,
          failureCode: null,
          attemptCount: { increment: 1 },
        },
      });
    }
    return { status: existing.status };
  }

  /**
   * Store a provider snapshot (ADR-P046: newest wins).
   *
   * Concurrent reconciles and webhooks can fetch the provider in one order and
   * write in another. Each write carries the time its snapshot was fetched, and
   * a write only lands if the stored snapshot is older — the predicate runs in
   * PostgreSQL, so a slow, stale fetch can never overwrite a newer one. The
   * insert is `ON CONFLICT DO NOTHING` (createMany skipDuplicates), so a
   * race on the first row never aborts the webhook transaction.
   *
   * Returns true when the stored entitlement changed (for the audit trail).
   */
  private async persistSnapshot(
    userId: string,
    snapshot: ProviderEntitlementSnapshot,
    eventTimestamp: Date | null,
    tx: Prisma.TransactionClient | null,
    fetchedAt: Date,
  ): Promise<boolean> {
    const client: Prisma.TransactionClient | PrismaService = tx ?? this.prisma;
    const before = await client.subscriptionEntitlement.findUnique({
      where: { userId },
    });
    const fields = {
      entitlementId: snapshot.entitlementId,
      isActive: snapshot.isActive,
      expiresAt: snapshot.expiresAt,
      periodType: snapshot.periodType,
      productId: snapshot.productId,
      store: snapshot.store,
      environment: snapshot.environment,
      willRenew: snapshot.willRenew,
      lastFetchedAt: fetchedAt,
      lastReconciledAt: new Date(),
    };
    const inserted = await client.subscriptionEntitlement.createMany({
      data: [{ userId, ...fields, lastProviderEventAt: eventTimestamp }],
      skipDuplicates: true,
    });
    let wrote = inserted.count === 1;
    if (!wrote) {
      const updated = await client.subscriptionEntitlement.updateMany({
        where: {
          userId,
          OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: fetchedAt } }],
        },
        data: fields,
      });
      wrote = updated.count === 1;
    }
    if (eventTimestamp) {
      // Do not derive the watermark in application memory: two different
      // event transactions can read the same old value. This predicate is
      // evaluated by PostgreSQL, so a late older delivery cannot overwrite a
      // newer watermark.
      await client.subscriptionEntitlement.updateMany({
        where: {
          userId,
          OR: [
            { lastProviderEventAt: null },
            { lastProviderEventAt: { lt: eventTimestamp } },
          ],
        },
        data: { lastProviderEventAt: eventTimestamp },
      });
    }
    return (
      wrote &&
      (before === null ||
        before.isActive !== snapshot.isActive ||
        before.expiresAt?.getTime() !== snapshot.expiresAt?.getTime() ||
        before.periodType !== snapshot.periodType ||
        before.productId !== snapshot.productId ||
        before.store !== snapshot.store ||
        before.environment !== snapshot.environment ||
        before.willRenew !== snapshot.willRenew)
    );
  }

  private persistWebhookSnapshots(
    event: ParsedRevenueCatEvent,
    snapshots: Array<{
      userId: string;
      snapshot: ProviderEntitlementSnapshot;
      fetchedAt: Date;
    }>,
  ): Promise<{
    claimed: boolean;
    changed: Array<{
      userId: string;
      snapshot: ProviderEntitlementSnapshot;
    }>;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const eventOwnerUserId =
        snapshots.length === 1
          ? snapshots[0].userId
          : (snapshots.find(({ userId }) =>
              event.transferDestinationUserIds.includes(userId),
            )?.userId ??
            snapshots
              .map(({ userId }) => userId)
              .sort((left, right) => left.localeCompare(right))[0] ??
            null);
      const claimed = await tx.subscriptionWebhookEvent.updateMany({
        where: {
          id: event.id,
          status: {
            in: [
              SubscriptionWebhookStatus.RECEIVED,
              SubscriptionWebhookStatus.FAILED,
            ],
          },
        },
        data: {
          // For a transfer, relate the payload-free ledger to the owned
          // destination (or one deterministic affected account as fallback).
          // That preserves account-deletion cascade without persisting every
          // provider alias from the payload.
          userId: eventOwnerUserId,
          status: SubscriptionWebhookStatus.PROCESSED,
          failureCode: null,
          processedAt: new Date(),
        },
      });
      if (claimed.count === 0) return { claimed: false, changed: [] };
      const changed: Array<{
        userId: string;
        snapshot: ProviderEntitlementSnapshot;
      }> = [];
      for (const item of snapshots) {
        if (
          await this.persistSnapshot(
            item.userId,
            item.snapshot,
            event.timestamp,
            tx,
            item.fetchedAt,
          )
        ) {
          changed.push(item);
        }
      }
      return { claimed: true, changed };
    });
  }

  /**
   * ADR-P049 amendment 1: the live provider view for the backoffice. Read
   * only; the local mirror is not touched.
   */
  async providerSnapshot(userId: string): Promise<ProviderEntitlementSnapshot> {
    this.assertProviderEnabled();
    return this.fetchSnapshot(userId);
  }

  /**
   * ADR-P049 amendment 1: staff grant or revoke promotional access through
   * RevenueCat (the provider stays the authority, ADR-P034), then the mirror
   * is refreshed from a fresh fetch at once, bypassing the reconcile spacing,
   * so the person's access follows without waiting for a webhook.
   */
  async staffChangePromotional(
    userId: string,
    change: { grant: PromotionalDuration } | { revoke: true },
  ): Promise<SubscriptionStatusView> {
    this.assertProviderEnabled();
    try {
      if ('grant' in change) {
        await this.provider.grantPromotional(userId, change.grant);
      } else {
        await this.provider.revokePromotionals(userId);
      }
    } catch {
      throw new ServiceUnavailableException(
        'The subscription provider did not accept the change',
      );
    }
    const snapshot = await this.fetchSnapshot(userId);
    const changed = await this.persistSnapshot(
      userId,
      snapshot,
      null,
      null,
      new Date(),
    );
    if (changed) await this.auditEntitlementChange(userId, snapshot, 'staff');
    return this.getStatus(userId);
  }

  private auditEntitlementChange(
    userId: string,
    snapshot: ProviderEntitlementSnapshot,
    source: 'manual' | 'webhook' | 'staff',
  ): Promise<void> {
    return this.audit.record({
      action: AuditAction.SUBSCRIPTION_ENTITLEMENT_CHANGE,
      userId,
      metadata: {
        active: snapshot.isActive,
        source,
        // Operational state only. No transaction, receipt, event or customer id.
        environment: snapshot.environment,
      },
    });
  }
}
