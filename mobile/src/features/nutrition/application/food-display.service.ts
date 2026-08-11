import type { SupportedLanguage } from '@/shared/localization';

import type { FoodItem } from '../domain/food-catalog';
import { FOOD_CATALOG } from '../infrastructure/food-catalog.data';
import { SPANISH_FOOD_NAMES } from '../infrastructure/food-catalog.es';

type DisplayableFood = Pick<FoodItem, 'id' | 'name'>;

/** Locale-specific label with the canonical English snapshot as safe fallback. */
export function foodDisplayName(food: DisplayableFood, language: SupportedLanguage): string {
  return language === 'es' ? (SPANISH_FOOD_NAMES[food.id] ?? food.name) : food.name;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

/**
 * Display search accepts both the selected locale and the canonical English
 * name. Results retain their original FoodItem identity and stable order.
 */
export function searchFoodsForDisplay(query: string, language: SupportedLanguage): FoodItem[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [];

  return FOOD_CATALOG.filter((food) => {
    const canonical = normalizeSearch(food.name);
    const localized = normalizeSearch(foodDisplayName(food, language));
    return canonical.includes(normalizedQuery) || localized.includes(normalizedQuery);
  });
}
