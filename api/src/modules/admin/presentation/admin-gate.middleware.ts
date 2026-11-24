import type { NextFunction, Request, Response } from 'express';

import type { AdminConfig } from '../admin.config';
import { STAFF_CSRF_HEADER } from '../domain/staff.types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Runs before every `/admin/api` route (ADR-P049):
 * - 503 when the backoffice is not configured (no secrets set).
 * - No caching of any response (`no-store`).
 * - CSRF: a state-changing request must carry `X-Admin-CSRF: 1`. A plain
 *   cross-site form or image request cannot set a custom header, and a
 *   cross-site fetch that sets one needs a CORS preflight, which the API's
 *   fail-closed CORS refuses. This sits on top of SameSite=Strict cookies.
 */
export function adminGate(config: AdminConfig) {
  return (request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('Cache-Control', 'no-store');
    if (!config.enabled) {
      response.status(503).json({
        statusCode: 503,
        message: 'The backoffice is not configured',
      });
      return;
    }
    if (
      !SAFE_METHODS.has(request.method) &&
      request.headers[STAFF_CSRF_HEADER] !== '1'
    ) {
      response.status(403).json({
        statusCode: 403,
        code: 'CSRF_HEADER_REQUIRED',
        message: 'Missing CSRF header',
      });
      return;
    }
    next();
  };
}
