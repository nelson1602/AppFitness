import type { NextFunction, Request, Response } from 'express';

/**
 * ADR-P046: `/auth` responses carry tokens and account data, so nothing may
 * cache them — not the client, not a proxy, not a CDN. Set before the route
 * runs, so a guard rejection or an error response carries it too.
 */
export function noStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}
