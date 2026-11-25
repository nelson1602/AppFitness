import { API_BASE_URL } from '@/shared/infrastructure/config/api-config';
import { logWarn } from '@/shared/infrastructure/logging';

import { type AppConfig, parseAppConfig } from '../domain/app-config';

export const APP_CONFIG_TIMEOUT_MS = 8000;

/**
 * Reads the public `GET /app-config` (ADR-P049 amendment 1). No account is
 * involved, so no Authorization header is sent. Never throws: an unreachable
 * server, a timeout or an error status resolves to `null` ("nothing new"); a
 * 2xx body is parsed defensively.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/app-config`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      logWarn('appConfig.fetch', 'request failed', { status: response.status });
      return null;
    }
    const body: unknown = await response.json();
    return parseAppConfig(body);
  } catch (error) {
    logWarn('appConfig.fetch', error instanceof Error ? error.name : 'unknown failure');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
