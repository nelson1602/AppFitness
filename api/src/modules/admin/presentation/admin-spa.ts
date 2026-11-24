import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';

import { resolveAdminConfig } from '../admin.config';

/**
 * Serves the built backoffice SPA (`admin/dist`) at /admin (ADR-P049), only
 * when the backoffice is configured and the build exists. The SPA uses hash
 * routes, so the static files are all it needs. Its JSON API is /admin/api,
 * handled by Nest routes; the static handler passes those through.
 */
export function configureAdminSpa(
  app: NestExpressApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const logger = new Logger('AdminSpa');
  const config = resolveAdminConfig(env);
  if (!config.enabled) return;
  const dir = resolve(
    config.staticDir ?? join(process.cwd(), '..', 'admin', 'dist'),
  );
  if (!existsSync(join(dir, 'index.html'))) {
    logger.warn('Backoffice SPA build not found; /admin is not served');
    return;
  }
  app.useStaticAssets(dir, {
    prefix: '/admin',
    index: 'index.html',
    fallthrough: true,
    setHeaders: (response: Response, path: string) => {
      // index.html must always be revalidated; hashed assets can be cached.
      response.setHeader(
        'Cache-Control',
        path.endsWith('index.html')
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
      );
    },
  });
}
