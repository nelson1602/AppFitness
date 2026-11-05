import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  FDC_PORK_SKINS_DETAIL,
  FDC_SEARCH_BODY,
  OFF_CHICHARRON,
  OFF_SEARCH_BODY,
} from '../../../../test/support/food-source-fixtures';
import type { FoodSourcesConfig } from '../../../config/food-sources.config';
import { deriveFoodId } from '../catalog/catalog-identity';
import type {
  CatalogFoodRow,
  FoodCatalogRepositoryPort,
  NewFoodRow,
} from '../domain/food-catalog.repository';
import {
  ExternalFoodClient,
  type FoodSourcesFetch,
  OFF_USER_AGENT,
} from '../infrastructure/external-food.client';
import { FoodSearchService } from './food-search.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const FDC_KEY = 'test-fdc-key-never-logged';

type Route = { status: number; body?: unknown } | 'network-error';

/** Mocked global fetch routed by URL; records every call. */
function mockFetch(routes: {
  offSearch?: Route;
  fdcSearch?: Route;
  offProduct?: Route;
  fdcFood?: Route;
}): jest.Mock {
  return jest.fn((input: string) => {
    const url = String(input);
    const route = url.includes('/cgi/search.pl')
      ? routes.offSearch
      : url.includes('/fdc/v1/foods/search')
        ? routes.fdcSearch
        : url.includes('/api/v2/product/')
          ? routes.offProduct
          : url.includes('/fdc/v1/food/')
            ? routes.fdcFood
            : undefined;
    if (!route || route === 'network-error') {
      return Promise.reject(new TypeError('fetch failed'));
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body ?? {}), { status: route.status }),
    );
  });
}

function row(patch: Partial<CatalogFoodRow>): CatalogFoodRow {
  return {
    id: deriveFoodId('food.x', 1),
    catalogKey: 'food.x',
    foodRevision: 1,
    catalogVersion: 'food-catalog@1.0.0',
    name: 'Food',
    brand: null,
    createdBy: null,
    servingAmount: 100,
    servingUnit: 'g',
    gramsPerServing: 100,
    caloriesPerServing: 100,
    proteinPerServing: 10,
    carbsPerServing: 10,
    fatPerServing: 2,
    fiberPerServing: null,
    ...patch,
  };
}

/** In-memory repository honouring the "global or own" visibility rule. */
class FakeFoods implements FoodCatalogRepositoryPort {
  rows: Array<CatalogFoodRow & { deletedAt: Date | null }> = [];
  inserts: NewFoodRow[] = [];

  searchVisible(
    userId: string,
    words: readonly string[],
    limit: number,
  ): Promise<CatalogFoodRow[]> {
    const fold = (s: string): string =>
      s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return Promise.resolve(
      this.rows
        .filter(
          (r) =>
            r.deletedAt === null &&
            (r.createdBy === null || r.createdBy === userId) &&
            words.every((w) => fold(r.name).includes(w)),
        )
        .slice(0, limit),
    );
  }

  findGlobalByCatalogKeys(keys: readonly string[]): Promise<CatalogFoodRow[]> {
    return Promise.resolve(
      this.rows.filter(
        (r) =>
          r.catalogKey !== null &&
          keys.includes(r.catalogKey) &&
          r.createdBy === null &&
          r.deletedAt === null,
      ),
    );
  }

  findById(
    id: string,
  ): Promise<(CatalogFoodRow & { deletedAt: Date | null }) | null> {
    return Promise.resolve(this.rows.find((r) => r.id === id) ?? null);
  }

  insertIfAbsent(newRow: NewFoodRow): Promise<void> {
    this.inserts.push(newRow);
    if (!this.rows.some((r) => r.id === newRow.id)) {
      this.rows.push({ ...newRow, deletedAt: null });
    }
    return Promise.resolve();
  }
}

function build(
  fetchMock: jest.Mock,
  fdcApiKey: string | null = FDC_KEY,
): { service: FoodSearchService; foods: FakeFoods } {
  const config: FoodSourcesConfig = { fdcApiKey, timeoutMs: 4000 };
  const client = new ExternalFoodClient(config, fetchMock as FoodSourcesFetch);
  const foods = new FakeFoods();
  return { service: new FoodSearchService(foods, client), foods };
}

const OK_ROUTES = {
  offSearch: { status: 200, body: OFF_SEARCH_BODY },
  fdcSearch: { status: 200, body: FDC_SEARCH_BODY },
};

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
});
afterEach(() => {
  // The FDC key travels in the request URL only: never in a log line.
  expect(JSON.stringify(warn.mock.calls)).not.toContain(FDC_KEY);
  warn.mockRestore();
});

describe('FoodSearchService.search (ADR-P045)', () => {
  it('"Chicharrón de cerdo": DB first, then ranked external hits, external ok', async () => {
    const fetchMock = mockFetch(OK_ROUTES);
    const { service, foods } = build(fetchMock);
    foods.rows.push(
      {
        ...row({
          id: deriveFoodId('food.chicharron', 1),
          catalogKey: 'food.chicharron',
          name: 'Chicharrón de cerdo frito',
        }),
        deletedAt: null,
      },
      {
        ...row({
          id: deriveFoodId('custom.mine', 1),
          catalogKey: 'custom.mine',
          name: 'Chicharrón de cerdo de mamá',
          createdBy: USER,
        }),
        deletedAt: null,
      },
      {
        ...row({
          id: deriveFoodId('custom.theirs', 1),
          catalogKey: 'custom.theirs',
          name: 'Chicharrón de cerdo secreto',
          createdBy: OTHER,
        }),
        deletedAt: null,
      },
    );

    const { results, external } = await service.search(
      USER,
      'chicharron de cerdo',
      15,
    );

    expect(external).toBe('ok');
    expect(results.slice(0, 2).map((r) => [r.source, r.sourceId])).toEqual([
      ['catalog', 'food.chicharron'],
      ['custom', 'custom.mine'],
    ]);
    expect(results.some((r) => r.sourceId === 'custom.theirs')).toBe(false);
    expect(results[2]).toMatchObject({
      source: 'off',
      sourceId: OFF_CHICHARRON.code,
      foodId: null,
      name: 'Chicharrón de cerdo',
      servingAmount: 100,
      servingUnit: 'g',
      gramsPerServing: 100,
    });
    expect(results[2]).not.toHaveProperty('spanishName');
    // FDC hits are present; FDC was queried in English and as typed.
    expect(results.some((r) => r.source === 'fdc')).toBe(true);
    const fdcBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/foods/search'))
      .map(
        ([, init]) =>
          JSON.parse((init as RequestInit).body as string) as {
            query: string;
            dataType: string[];
          },
      );
    expect(fdcBodies.map((b) => b.query)).toEqual([
      'pork rinds',
      'chicharron de cerdo',
    ]);
    expect(fdcBodies[0].dataType).toEqual([
      'Foundation',
      'SR Legacy',
      'Survey (FNDDS)',
      'Branded',
    ]);
    // Implausible / incomplete external items never surface.
    expect(results.some((r) => r.name === 'Chicharrón error de carga')).toBe(
      false,
    );
    expect(results.some((r) => r.name === 'Incomplete food')).toBe(false);
  });

  it('sends the OFF query in Spanish with the identifying User-Agent', async () => {
    const fetchMock = mockFetch(OK_ROUTES);
    await build(fetchMock).service.search(USER, 'Chicharrón de cerdo', 5);

    const [url, init] = fetchMock.mock.calls.find(([u]) =>
      String(u).includes('/cgi/search.pl'),
    ) as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get('search_terms')).toBe('Chicharrón de cerdo');
    expect(params.get('lc')).toBe('es');
    expect(params.get('page_size')).toBe('5');
    expect(params.get('fields')).toBe(
      'code,product_name,product_name_es,brands,nutriments',
    );
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      OFF_USER_AGENT,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns an already-imported external hit as the catalogue food, once', async () => {
    const { service, foods } = build(mockFetch(OK_ROUTES));
    const importedId = deriveFoodId(`off.${OFF_CHICHARRON.code}`, 1);
    foods.rows.push({
      ...row({
        id: importedId,
        catalogKey: `off.${OFF_CHICHARRON.code}`,
        name: 'Chicharrón de cerdo',
        catalogVersion: 'external@1',
      }),
      deletedAt: null,
    });

    const { results } = await service.search(USER, 'chicharron de cerdo', 15);

    const matches = results.filter(
      (r) => r.foodId === importedId || r.sourceId === OFF_CHICHARRON.code,
    );
    expect(matches).toEqual([
      expect.objectContaining({
        source: 'catalog',
        sourceId: `off.${OFF_CHICHARRON.code}`,
        foodId: importedId,
      }),
    ]);
  });

  it('both sources failing → unavailable, DB results still returned', async () => {
    const { service, foods } = build(
      mockFetch({ offSearch: 'network-error', fdcSearch: { status: 500 } }),
    );
    foods.rows.push({ ...row({ name: 'Arroz blanco' }), deletedAt: null });

    const response = await service.search(USER, 'arroz', 15);

    expect(response.external).toBe('unavailable');
    expect(response.results.map((r) => r.name)).toEqual(['Arroz blanco']);
  });

  it('no FDC key → FDC skipped (never called) and external partial', async () => {
    const fetchMock = mockFetch(OK_ROUTES);
    const { service } = build(fetchMock, null);

    const response = await service.search(USER, 'chicharron', 15);

    expect(response.external).toBe('partial');
    expect(
      fetchMock.mock.calls.some(([u]) =>
        String(u).includes('api.nal.usda.gov'),
      ),
    ).toBe(false);
    expect(response.results.every((r) => r.source !== 'fdc')).toBe(true);
  });

  it('one source answering malformed JSON → partial', async () => {
    const fetchMock = jest.fn((url: string) =>
      Promise.resolve(
        String(url).includes('/cgi/search.pl')
          ? new Response('<html>busy</html>', { status: 200 })
          : new Response(JSON.stringify(FDC_SEARCH_BODY), { status: 200 }),
      ),
    );
    const response = await build(fetchMock).service.search(USER, 'pork', 15);
    expect(response.external).toBe('partial');
  });

  it('caps the total at the limit', async () => {
    const { service } = build(mockFetch(OK_ROUTES));
    const response = await service.search(USER, 'chicharron de cerdo', 2);
    expect(response.results).toHaveLength(2);
  });
});

describe('FoodSearchService.importExternal (ADR-P045)', () => {
  it('re-fetches the FDC food server-side and stores it in the shared catalogue', async () => {
    const fetchMock = mockFetch({
      fdcFood: { status: 200, body: FDC_PORK_SKINS_DETAIL },
    });
    const { service, foods } = build(fetchMock);

    const food = await service.importExternal('fdc', '168201');

    expect(food).toEqual({
      id: deriveFoodId('fdc.168201', 1),
      catalogKey: 'fdc.168201',
      foodRevision: 1,
      catalogVersion: 'external@1',
      name: 'Snacks, pork skins, plain',
      category: 'external',
      servingAmount: 100,
      servingUnit: 'g',
      gramsPerServing: 100,
      caloriesPerServing: 544.1,
      proteinPerServing: 61.3,
      carbsPerServing: 0,
      fatPerServing: 31.3,
      fiberPerServing: 0.5,
    });
    expect(foods.inserts).toHaveLength(1);
    expect(foods.inserts[0].createdBy).toBeNull();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      `https://api.nal.usda.gov/fdc/v1/food/168201?api_key=${FDC_KEY}`,
    );
  });

  it('stores the OFF Spanish name and is idempotent (second call: no fetch, same food)', async () => {
    const fetchMock = mockFetch({
      offProduct: { status: 200, body: { status: 1, product: OFF_CHICHARRON } },
    });
    const { service, foods } = build(fetchMock);

    const first = await service.importExternal('off', OFF_CHICHARRON.code);
    const second = await service.importExternal('off', OFF_CHICHARRON.code);

    expect(first.name).toBe('Chicharrón de cerdo');
    expect(first.catalogKey).toBe(`off.${OFF_CHICHARRON.code}`);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(foods.inserts).toHaveLength(1);
  });

  it('macros come only from the source, whatever an earlier search showed', async () => {
    // The source now reports different values: the stored food follows the
    // re-fetch, never a client-supplied payload.
    const changed = {
      ...OFF_CHICHARRON,
      nutriments: { ...OFF_CHICHARRON.nutriments, 'energy-kcal_100g': 500 },
    };
    const { service } = build(
      mockFetch({
        offProduct: { status: 200, body: { status: 1, product: changed } },
      }),
    );
    const food = await service.importExternal('off', OFF_CHICHARRON.code);
    expect(food.caloriesPerServing).toBe(500);
  });

  it('404 when the source has no such item or it fails normalization', async () => {
    const missing = build(mockFetch({ fdcFood: { status: 404 } })).service;
    await expect(missing.importExternal('fdc', '1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const statusZero = build(
      mockFetch({ offProduct: { status: 200, body: { status: 0 } } }),
    ).service;
    await expect(
      statusZero.importExternal('off', '7460000000017'),
    ).rejects.toBeInstanceOf(NotFoundException);
    const bad = build(
      mockFetch({
        offProduct: {
          status: 200,
          body: {
            status: 1,
            product: { product_name_es: 'x', nutriments: {} },
          },
        },
      }),
    ).service;
    await expect(
      bad.importExternal('off', '7460000000017'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('503 when the source is unreachable or FDC has no key', async () => {
    const down = build(mockFetch({ offProduct: 'network-error' })).service;
    await expect(
      down.importExternal('off', '7460000000017'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const noKey = build(mockFetch({}), null).service;
    await expect(noKey.importExternal('fdc', '168201')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects a non-numeric source id without any fetch', async () => {
    const fetchMock = mockFetch({});
    await expect(
      build(fetchMock).service.importExternal('off', '../admin'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FoodSearchService.createCustom (ADR-P045)', () => {
  const input = {
    name: 'Chicharrón de cerdo',
    servingAmount: 1,
    servingUnit: 'serving' as const,
    gramsPerServing: 50,
    caloriesPerServing: 270,
    proteinPerServing: 30,
    carbsPerServing: 0,
    fatPerServing: 16,
  };

  it('creates a private food owned by the caller', async () => {
    const { service, foods } = build(mockFetch({}));

    const food = await service.createCustom(USER, input);

    expect(food).toMatchObject({
      foodRevision: 1,
      catalogVersion: 'custom@1',
      category: 'custom',
      name: 'Chicharrón de cerdo',
      gramsPerServing: 50,
      caloriesPerServing: 270,
      fiberPerServing: null,
    });
    expect(food.catalogKey).toMatch(
      /^custom\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(food.id).toBe(deriveFoodId(food.catalogKey, 1));
    expect(foods.inserts[0].createdBy).toBe(USER);
  });

  it('is visible to its creator only', async () => {
    const { service } = build(
      mockFetch({ offSearch: { status: 200, body: { products: [] } } }),
    );
    await service.createCustom(USER, input);

    const mine = await service.search(USER, 'chicharron', 15);
    const theirs = await service.search(OTHER, 'chicharron', 15);

    expect(mine.results.filter((r) => r.source === 'custom')).toHaveLength(1);
    expect(theirs.results.some((r) => r.source === 'custom')).toBe(false);
  });

  it('uses the serving amount as grams for a gram portion', async () => {
    const { service } = build(mockFetch({}));
    const food = await service.createCustom(USER, {
      ...input,
      servingAmount: 80,
      servingUnit: 'g',
      gramsPerServing: null,
    });
    expect(food.gramsPerServing).toBe(80);
  });

  it.each([
    ['more than 9 kcal per gram', { caloriesPerServing: 451 }],
    [
      'macros heavier than the portion',
      { proteinPerServing: 40, fatPerServing: 11 },
    ],
  ])('rejects %s', async (_label, patch) => {
    const { service, foods } = build(mockFetch({}));
    await expect(
      service.createCustom(USER, { ...input, ...patch }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(foods.inserts).toHaveLength(0);
  });

  it('accepts any macros when the portion weight is unknown', async () => {
    const { service } = build(mockFetch({}));
    await expect(
      service.createCustom(USER, {
        ...input,
        servingUnit: 'cup',
        gramsPerServing: undefined,
        caloriesPerServing: 900,
      }),
    ).resolves.toMatchObject({ gramsPerServing: null });
  });
});
