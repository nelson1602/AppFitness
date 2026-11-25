import { ApiError, errorMessage } from '../../api/client';
import { SERVING_UNITS } from '../../api/types';
import type { CatalogFoodView, ServingUnit } from '../../api/types';
import type { BannerMessage } from '../../components/Banner';
import { formatNumber } from '../../format';
import { es } from '../../i18n/es';

/** A banner tied to the view it belongs to (`null` = the food list). */
export interface CatalogNotice {
  at: string | null;
  message: BannerMessage;
}

export type NotifyFn = (at: string | null, message: BannerMessage) => void;

export function isServingUnit(value: string): value is ServingUnit {
  return (SERVING_UNITS as readonly string[]).includes(value);
}

export function unitLabel(unit: string): string {
  return isServingUnit(unit) ? es.catalog.units[unit] : unit;
}

export function servingText(food: CatalogFoodView): string {
  const amount = formatNumber(food.servingAmount);
  const unit = unitLabel(food.servingUnit);
  return food.gramsPerServing === null
    ? es.catalog.serving(amount, unit)
    : es.catalog.servingWithGrams(
        amount,
        unit,
        formatNumber(food.gramsPerServing),
      );
}

/**
 * 409 → "reload" message; 400 → the server's own validation message (for
 * example kcal per gram or macros heavier than the portion); otherwise the
 * shared mapping.
 */
export function catalogErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return es.catalog.conflict;
    if (error.status === 400 && error.message) {
      return es.catalog.invalidData(error.message);
    }
  }
  return errorMessage(error);
}
