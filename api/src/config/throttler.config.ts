import { isIP } from 'node:net';

import { seconds, type ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate-limiting configuration + client-tracker resolver (ADR-P020 C-1A).
 *
 * The 2026-08-21 Development live test disproved the original `trust proxy = 1`
 * assumption: Railway fronts the container with a proxy chain whose depth does
 * not match a single hop, so Express `req.ip` resolved to a *varying* internal
 * address and the per-IP throttle key fragmented (request 21 never returned
 * 429). The fix keys the throttler on Railway's sanitized client IP instead.
 *
 * Railway platform contract (current): the edge controls/sanitizes the
 * `X-Forwarded-For` header and places the real connecting client IP in the
 * FIRST (left-most) entry. We therefore trust ONLY that first value, and ONLY
 * when the platform marker `RAILWAY_ENVIRONMENT_ID` is present. Off Railway we
 * fall back to the normal `req.ip` and never trust arbitrary client XFF.
 */

/** Default (unnamed) throttler: 120 requests / 60 s per handler + tracker. */
export const DEFAULT_THROTTLER_LIMIT = 120;
export const DEFAULT_THROTTLER_TTL_SECONDS = 60;

/**
 * Deterministic, shared fail-closed tracker key. When Railway's XFF is
 * missing/non-string/empty/array-valued or its first entry is not a valid IP,
 * every such request collapses to THIS single key so they share one bucket and
 * are rate-limited together — never a varying key that would evade the limit.
 * It is a fixed sentinel, not any real or proxy address, so no IP is exposed.
 */
export const FAIL_CLOSED_TRACKER_KEY = 'railway-client-unresolved';

/** Minimal shape the tracker reads from the request (framework-agnostic). */
export interface TrackerRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/** True when running on Railway (the platform injects `RAILWAY_ENVIRONMENT_ID`). */
export function isRailwayRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const marker = env.RAILWAY_ENVIRONMENT_ID;
  return typeof marker === 'string' && marker.length > 0;
}

/**
 * Pure per-request tracker resolver.
 *
 * - On Railway: use the sanitized first `X-Forwarded-For` entry when it is a
 *   valid IPv4/IPv6; otherwise the shared fail-closed key.
 * - Off Railway: use `req.ip`; ignore client-supplied XFF as a direct source.
 *
 * Never logs or returns anything derived from an untrusted proxy address.
 */
export function resolveTrackerKey(
  req: TrackerRequest,
  railway: boolean,
): string {
  if (!railway) {
    return typeof req.ip === 'string' && req.ip.length > 0
      ? req.ip
      : FAIL_CLOSED_TRACKER_KEY;
  }

  const xff = req.headers?.['x-forwarded-for'];
  // Missing, array-valued (multiple XFF headers), or non-string → fail closed.
  if (typeof xff !== 'string' || xff.length === 0) {
    return FAIL_CLOSED_TRACKER_KEY;
  }

  const first = (xff.split(',')[0] ?? '').trim();
  return isIP(first) !== 0 ? first : FAIL_CLOSED_TRACKER_KEY;
}

/**
 * Build the single default in-memory throttler with the Railway-aware tracker.
 * Storage, limit, TTL, decorators, headers, and the generic 429 are unchanged;
 * only the tracker key is corrected. Railway mode is evaluated per request so
 * the same build works both on and off the platform.
 */
export function buildThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        ttl: seconds(DEFAULT_THROTTLER_TTL_SECONDS),
        limit: DEFAULT_THROTTLER_LIMIT,
      },
    ],
    getTracker: (req: Record<string, unknown>): string =>
      resolveTrackerKey(req, isRailwayRuntime()),
  };
}
