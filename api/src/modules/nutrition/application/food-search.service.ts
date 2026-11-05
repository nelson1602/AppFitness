import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  type CanonicalFood,
  FOOD_REVISION,
  deriveFoodId,
} from '../catalog/catalog-identity';
import {
  type ExternalFood,
  type ExternalFoodSource,
  type FoodSearchResult,
  externalCatalogKey,
  foldText,
  isValidExternalSourceId,
  queryWords,
  rankExternal,
  toSearchResult,
  translateQueryToEnglish,
} from '../catalog/external-food';
import {
  type CatalogFoodRow,
  FoodCatalogRepositoryPort,
  type NewFoodRow,
} from '../domain/food-catalog.repository';
import {
  ExternalFoodClient,
  ExternalSourceUnavailableError,
} from '../infrastructure/external-food.client';

export type ExternalStatus = 'ok' | 'partial' | 'unavailable';

export interface FoodSearchResponse {
  results: FoodSearchResult[];
  external: ExternalStatus;
}

export const EXTERNAL_CATALOG_VERSION = 'external@1';
export const CUSTOM_CATALOG_VERSION = 'custom@1';

export const CUSTOM_SERVING_UNITS = [
  'g',
  'ml',
  'serving',
  'piece',
  'cup',
  'tbsp',
  'tsp',
] as const;
export type CustomServingUnit = (typeof CUSTOM_SERVING_UNITS)[number];

export interface CustomFoodInput {
  name: string;
  servingAmount: number;
  servingUnit: CustomServingUnit;
  gramsPerServing?: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

/** Fat is the densest macro: 9 kcal per gram. */
const MAX_KCAL_PER_GRAM = 9;

type SourceOutcome = { ok: true; items: ExternalFood[] } | { ok: false };

/**
 * Food search beyond the bundled list, external import into the shared,
 * self-growing catalogue, and private custom foods (ADR-P045).
 */
@Injectable()
export class FoodSearchService {
  private readonly logger = new Logger(FoodSearchService.name);

  constructor(
    private readonly foods: FoodCatalogRepositoryPort,
    private readonly external: ExternalFoodClient,
  ) {}

  async search(
    userId: string,
    query: string,
    limit: number,
  ): Promise<FoodSearchResponse> {
    const words = queryWords(query);
    const dbWords = words.length > 0 ? words : foldText(query).split(' ');
    const dbRows = await this.foods.searchVisible(
      userId,
      dbWords.filter((w) => w !== ''),
      limit,
    );
    const results: FoodSearchResult[] = dbRows.map((row) =>
      this.rowToResult(row, userId),
    );

    const [off, fdc] = await Promise.all([
      this.searchOff(query, limit),
      this.searchFdc(query, limit),
    ]);
    const external: ExternalStatus =
      off.ok && fdc.ok ? 'ok' : off.ok || fdc.ok ? 'partial' : 'unavailable';

    const ranked = rankExternal(
      [...(off.ok ? off.items : []), ...(fdc.ok ? fdc.items : [])],
      query,
    );
    // An external hit already imported is returned as that catalogue food.
    const imported = new Map(
      (
        await this.foods.findGlobalByCatalogKeys(
          ranked.map((i) => externalCatalogKey(i.source, i.sourceId)),
        )
      ).map((row) => [row.catalogKey, row]),
    );
    const seenFoodIds = new Set(dbRows.map((row) => row.id));
    for (const item of ranked) {
      if (results.length >= limit) break;
      const row = imported.get(externalCatalogKey(item.source, item.sourceId));
      if (!row) {
        results.push(toSearchResult(item));
      } else if (!seenFoodIds.has(row.id)) {
        seenFoodIds.add(row.id);
        results.push(this.rowToResult(row, userId));
      }
    }
    return { results: results.slice(0, limit), external };
  }

  /**
   * Re-fetches the item from its source (client macros are never accepted),
   * normalizes it and stores it once in the shared catalogue.
   */
  async importExternal(
    source: ExternalFoodSource,
    sourceId: string,
  ): Promise<CanonicalFood> {
    if (!isValidExternalSourceId(source, sourceId)) {
      throw new NotFoundException('Food not found at the source');
    }
    const catalogKey = externalCatalogKey(source, sourceId);
    const id = deriveFoodId(catalogKey, FOOD_REVISION);

    const existing = await this.foods.findById(id);
    if (existing) {
      if (existing.deletedAt !== null) {
        throw new NotFoundException('Food not found at the source');
      }
      return toCanonical(existing, 'external');
    }

    let item: ExternalFood | null;
    try {
      item =
        source === 'fdc'
          ? await this.external.fetchFdc(sourceId)
          : await this.external.fetchOff(sourceId);
    } catch (error) {
      if (error instanceof ExternalSourceUnavailableError) {
        throw new ServiceUnavailableException('Food source is unavailable');
      }
      throw error;
    }
    if (!item) throw new NotFoundException('Food not found at the source');

    const row: NewFoodRow = {
      id,
      catalogKey,
      foodRevision: FOOD_REVISION,
      catalogVersion: EXTERNAL_CATALOG_VERSION,
      name: item.name,
      brand: item.brand,
      createdBy: null,
      servingAmount: item.servingAmount,
      servingUnit: item.servingUnit,
      gramsPerServing: item.gramsPerServing,
      caloriesPerServing: item.caloriesPerServing,
      proteinPerServing: item.proteinPerServing,
      carbsPerServing: item.carbsPerServing,
      fatPerServing: item.fatPerServing,
      fiberPerServing: item.fiberPerServing,
    };
    await this.foods.insertIfAbsent(row);
    // Re-read: a concurrent import may have stored the revision first.
    const stored = await this.foods.findById(id);
    return toCanonical(stored ?? { ...row }, 'external');
  }

  /** A private food: visible to and loggable by its creator only. */
  async createCustom(
    userId: string,
    input: CustomFoodInput,
  ): Promise<CanonicalFood> {
    const gramsPerServing =
      input.gramsPerServing ??
      (input.servingUnit === 'g' ? input.servingAmount : null);
    if (gramsPerServing !== null) {
      const macroGrams =
        input.proteinPerServing + input.carbsPerServing + input.fatPerServing;
      if (input.caloriesPerServing / gramsPerServing > MAX_KCAL_PER_GRAM) {
        throw new BadRequestException(
          'caloriesPerServing is implausible for the portion weight',
        );
      }
      if (macroGrams > gramsPerServing) {
        throw new BadRequestException(
          'protein, carbs and fat cannot weigh more than the portion',
        );
      }
    }

    const catalogKey = `custom.${randomUUID()}`;
    const row: NewFoodRow = {
      id: deriveFoodId(catalogKey, FOOD_REVISION),
      catalogKey,
      foodRevision: FOOD_REVISION,
      catalogVersion: CUSTOM_CATALOG_VERSION,
      name: input.name,
      brand: null,
      createdBy: userId,
      servingAmount: input.servingAmount,
      servingUnit: input.servingUnit,
      gramsPerServing,
      caloriesPerServing: input.caloriesPerServing,
      proteinPerServing: input.proteinPerServing,
      carbsPerServing: input.carbsPerServing,
      fatPerServing: input.fatPerServing,
      fiberPerServing: null,
    };
    await this.foods.insertIfAbsent(row);
    return toCanonical(row, 'custom');
  }

  private async searchOff(
    query: string,
    limit: number,
  ): Promise<SourceOutcome> {
    try {
      return { ok: true, items: await this.external.searchOff(query, limit) };
    } catch (error) {
      this.logSourceFailure('off', error);
      return { ok: false };
    }
  }

  /** Searches the query and, when it differs, its English translation. */
  private async searchFdc(
    query: string,
    limit: number,
  ): Promise<SourceOutcome> {
    if (!this.external.fdcEnabled) return { ok: false };
    const english = translateQueryToEnglish(query);
    const queries =
      english !== '' && english !== foldText(query)
        ? [english, query]
        : [query];
    const settled = await Promise.allSettled(
      queries.map((q) => this.external.searchFdc(q, limit)),
    );
    const items: ExternalFood[] = [];
    let ok = false;
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        ok = true;
        items.push(...outcome.value);
      } else {
        this.logSourceFailure('fdc', outcome.reason);
      }
    }
    return ok ? { ok: true, items } : { ok: false };
  }

  private logSourceFailure(source: 'fdc' | 'off', error: unknown): void {
    // Never the URL (it carries the FDC key) — only the source and the kind.
    const kind =
      error instanceof ExternalSourceUnavailableError ? 'unavailable' : 'error';
    this.logger.warn(`External food search failed: ${source} (${kind})`);
  }

  private rowToResult(row: CatalogFoodRow, userId: string): FoodSearchResult {
    return {
      source:
        row.createdBy !== null && row.createdBy === userId
          ? 'custom'
          : 'catalog',
      sourceId: row.catalogKey ?? row.id,
      foodId: row.id,
      name: row.name,
      brand: row.brand,
      servingAmount: row.servingAmount,
      servingUnit: row.servingUnit,
      gramsPerServing: row.gramsPerServing,
      caloriesPerServing: row.caloriesPerServing,
      proteinPerServing: row.proteinPerServing,
      carbsPerServing: row.carbsPerServing,
      fatPerServing: row.fatPerServing,
      fiberPerServing: row.fiberPerServing,
    };
  }
}

function toCanonical(
  row: Omit<CatalogFoodRow, 'createdBy'> & { catalogKey: string | null },
  category: 'external' | 'custom',
): CanonicalFood {
  return {
    id: row.id,
    catalogKey: row.catalogKey ?? row.id,
    foodRevision: row.foodRevision,
    catalogVersion: row.catalogVersion ?? '',
    name: row.name,
    category,
    servingAmount: row.servingAmount,
    servingUnit: row.servingUnit,
    gramsPerServing: row.gramsPerServing,
    caloriesPerServing: row.caloriesPerServing,
    proteinPerServing: row.proteinPerServing,
    carbsPerServing: row.carbsPerServing,
    fatPerServing: row.fatPerServing,
    fiberPerServing: row.fiberPerServing,
  };
}
