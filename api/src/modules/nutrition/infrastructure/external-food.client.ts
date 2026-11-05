import { Inject, Injectable } from '@nestjs/common';

import {
  FOOD_SOURCES_CONFIG,
  type FoodSourcesConfig,
} from '../../../config/food-sources.config';
import {
  type ExternalFood,
  normalizeFdcFood,
  normalizeOffProduct,
} from '../catalog/external-food';

export const FOOD_SOURCES_FETCH = Symbol('FOOD_SOURCES_FETCH');
export type FoodSourcesFetch = typeof fetch;

/** The source could not be reached, timed out or answered an error. */
export class ExternalSourceUnavailableError extends Error {
  constructor(readonly source: 'fdc' | 'off') {
    super(`External food source unavailable: ${source}`);
  }
}

const OFF_BASE = 'https://world.openfoodfacts.org';
/** Open Food Facts' current full-text search (search-a-licious). */
const OFF_SEARCH_BASE = 'https://search.openfoodfacts.org';
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
/** Open Food Facts asks every client to identify itself. */
export const OFF_USER_AGENT = 'AppFitnessRD/1.0 (+https://appfitnessrd.com)';
const OFF_FIELDS = 'code,product_name,product_name_es,brands,nutriments';
export const FDC_DATA_TYPES = [
  'Foundation',
  'SR Legacy',
  'Survey (FNDDS)',
  'Branded',
] as const;

/**
 * HTTP access to Open Food Facts and USDA FoodData Central (ADR-P045). Every
 * call has the configured timeout. Error messages never include the request
 * URL, so the FDC key cannot leak into logs or responses.
 */
@Injectable()
export class ExternalFoodClient {
  constructor(
    @Inject(FOOD_SOURCES_CONFIG) private readonly config: FoodSourcesConfig,
    @Inject(FOOD_SOURCES_FETCH) private readonly fetchImpl: FoodSourcesFetch,
  ) {}

  get fdcEnabled(): boolean {
    return this.config.fdcApiKey !== null;
  }

  /**
   * Open Food Facts search: the current search service first, the legacy
   * `search.pl` endpoint when it fails (it returned 503 on 2026-11-05).
   */
  async searchOff(query: string, limit: number): Promise<ExternalFood[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        langs: 'es',
        page_size: String(limit),
        fields: OFF_FIELDS,
      });
      const body = await this.getJson(
        'off',
        `${OFF_SEARCH_BASE}/search?${params.toString()}`,
      );
      const hits = (body as { hits?: unknown } | null)?.hits;
      if (Array.isArray(hits)) {
        return hits
          .map(normalizeOffProduct)
          .filter((f): f is ExternalFood => f !== null);
      }
    } catch {
      // Falls through to the legacy search below.
    }
    return this.searchOffLegacy(query, limit);
  }

  private async searchOffLegacy(
    query: string,
    limit: number,
  ): Promise<ExternalFood[]> {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      json: '1',
      page_size: String(limit),
      lc: 'es',
      fields: OFF_FIELDS,
    });
    const body = await this.getJson(
      'off',
      `${OFF_BASE}/cgi/search.pl?${params.toString()}`,
    );
    const products = (body as { products?: unknown } | null)?.products;
    return Array.isArray(products)
      ? products
          .map(normalizeOffProduct)
          .filter((f): f is ExternalFood => f !== null)
      : [];
  }

  async searchFdc(query: string, limit: number): Promise<ExternalFood[]> {
    const key = this.requireFdcKey();
    const body = await this.request(
      'fdc',
      `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          dataType: FDC_DATA_TYPES,
          pageSize: limit,
        }),
      },
    );
    const foods = (body as { foods?: unknown } | null)?.foods;
    return Array.isArray(foods)
      ? foods.map(normalizeFdcFood).filter((f): f is ExternalFood => f !== null)
      : [];
  }

  /** @returns null when Open Food Facts has no such product or it fails normalization. */
  async fetchOff(code: string): Promise<ExternalFood | null> {
    const body = await this.getJson(
      'off',
      `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
    );
    const parsed = body as { status?: unknown; product?: unknown } | null;
    if (!parsed || parsed.status !== 1) return null;
    // The requested code is the identity, whatever spelling the body uses.
    return normalizeOffProduct({ ...asObject(parsed.product), code });
  }

  /** @returns null when FDC has no such food or it fails normalization. */
  async fetchFdc(fdcId: string): Promise<ExternalFood | null> {
    const key = this.requireFdcKey();
    const body = await this.getJson(
      'fdc',
      `${FDC_BASE}/food/${encodeURIComponent(fdcId)}?api_key=${encodeURIComponent(key)}`,
    );
    const food = body ? normalizeFdcFood(body) : null;
    return food && food.sourceId === fdcId ? food : null;
  }

  private requireFdcKey(): string {
    if (this.config.fdcApiKey === null) {
      throw new ExternalSourceUnavailableError('fdc');
    }
    return this.config.fdcApiKey;
  }

  /** GET; a 404 resolves to null (no such item). */
  private getJson(source: 'fdc' | 'off', url: string): Promise<unknown> {
    return this.request(source, url, { method: 'GET' });
  }

  private async request(
    source: 'fdc' | 'off',
    url: string,
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(source === 'off' ? { 'User-Agent': OFF_USER_AGENT } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new ExternalSourceUnavailableError(source);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new ExternalSourceUnavailableError(source);
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new ExternalSourceUnavailableError(source);
    }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
