import type { RevenueCatConfig } from '../../../config/revenuecat.config';

/** The stored entitlement fields the access rule reads. */
export interface EntitlementRowForAccess {
  entitlementId: string;
  isActive: boolean;
  expiresAt: Date | null;
  environment: string | null;
}

/**
 * Whether a stored entitlement grants paid access right now (ADR-P034 D5,
 * ADR-P046). One rule for the paid-write guard and the status view, so the
 * two can never disagree.
 *
 * - It must be for the entitlement this environment sells, active, and not
 *   past its expiry.
 * - ADR-P046: in production a SANDBOX (test-purchase) entitlement grants
 *   nothing, unless the account is an allow-listed tester.
 */
export function entitlementGrantsAccess(
  row: EntitlementRowForAccess | null,
  config: RevenueCatConfig,
  userId: string,
  nowMs: number = Date.now(),
): boolean {
  if (!row || config.provider !== 'revenuecat') return false;
  if (row.entitlementId !== config.entitlementId) return false;
  if (!row.isActive) return false;
  if (row.expiresAt !== null && row.expiresAt.getTime() <= nowMs) return false;
  if (
    config.rejectSandbox &&
    row.environment === 'SANDBOX' &&
    !config.sandboxAllowedUserIds.has(userId.toLowerCase())
  ) {
    return false;
  }
  return true;
}
