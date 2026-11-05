import { Logger } from '@nestjs/common';

/**
 * External food sources configuration (ADR-P045).
 *
 * `FDC_API_KEY` is optional: without it the USDA FoodData Central search and
 * import are skipped (search answers `external: 'partial'`) and a single
 * warning is logged at startup. The key value is never logged, returned or
 * shipped to the app. Open Food Facts needs no key.
 */
export const FOOD_SOURCES_CONFIG = Symbol('FOOD_SOURCES_CONFIG');

/** Per-request timeout for every external call. */
export const EXTERNAL_FOOD_TIMEOUT_MS = 4000;

export interface FoodSourcesConfig {
  /** Secret api.data.gov key. Never log or return it. */
  fdcApiKey: string | null;
  timeoutMs: number;
}

export function resolveFoodSourcesConfig(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Logger, 'warn'> = new Logger('FoodSources'),
): FoodSourcesConfig {
  const key = (env.FDC_API_KEY ?? '').trim();
  if (key === '') {
    logger.warn(
      'FDC_API_KEY is not set: USDA FoodData Central search and import are disabled',
    );
  }
  return {
    fdcApiKey: key === '' ? null : key,
    timeoutMs: EXTERNAL_FOOD_TIMEOUT_MS,
  };
}
