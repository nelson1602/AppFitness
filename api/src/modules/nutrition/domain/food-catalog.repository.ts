/** A persisted food revision as the search/import/custom paths read it. */
export interface CatalogFoodRow {
  id: string;
  catalogKey: string | null;
  foodRevision: number;
  catalogVersion: string | null;
  name: string;
  brand: string | null;
  createdBy: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

/** A new food revision row (shared external import or private custom food). */
export interface NewFoodRow {
  id: string;
  catalogKey: string;
  foodRevision: number;
  catalogVersion: string;
  name: string;
  brand: string | null;
  createdBy: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

/**
 * Repository port for the food catalogue's REST paths (ADR-P045). Visibility
 * is always "global (createdBy null) or the caller's own".
 */
export abstract class FoodCatalogRepositoryPort {
  /**
   * Active foods visible to `userId` whose name contains every folded word
   * (accent- and case-insensitive), at most `limit` rows, deterministic order.
   */
  abstract searchVisible(
    userId: string,
    foldedWords: readonly string[],
    limit: number,
  ): Promise<CatalogFoodRow[]>;
  /** Active GLOBAL foods with one of these catalog keys (imported externals). */
  abstract findGlobalByCatalogKeys(
    catalogKeys: readonly string[],
  ): Promise<CatalogFoodRow[]>;
  /** The row with this id, including soft-deleted ones; null when absent. */
  abstract findById(
    id: string,
  ): Promise<(CatalogFoodRow & { deletedAt: Date | null }) | null>;
  /** Inserts the row unless its id/revision already exists (race-safe). */
  abstract insertIfAbsent(row: NewFoodRow): Promise<void>;
}
