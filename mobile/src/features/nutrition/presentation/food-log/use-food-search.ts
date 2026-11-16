import { useEffect, useMemo, useState } from 'react';

import { logError } from '@/shared/infrastructure/logging';
import type { SupportedLanguage } from '@/shared/localization';

import { searchFoodsForDisplay } from '../../application/food-display.service';
import { foodItemFromCanonical, rememberBrands } from '../../application/remote-food.service';
import type { FoodItem } from '../../domain/food-catalog';
import {
  FoodSearchOfflineError,
  type FoodSearchResult,
  searchRemoteFoods,
} from '../../infrastructure/food-search-api';
import { searchSavedFoods } from '../../infrastructure/saved-foods.repository';

/** How the server search went (v10 Block B, item 7). */
export type RemoteSearchStatus =
  'idle' | 'loading' | 'ok' | 'partial' | 'unavailable' | 'offline' | 'error';

const MAX_LOCAL = 8;
/** Fewer characters search only on the phone. */
export const REMOTE_MIN_CHARS = 2;
const DEBOUNCE_MS = 450;

/**
 * Food search for the log form: the bundled catalogue and the foods saved on
 * the phone answer at once (offline too); the server — shared catalogue, USDA
 * FoodData Central, Open Food Facts — answers after a pause in typing. Server
 * results already shown locally are left out.
 */
export function useFoodSearch(
  query: string,
  language: SupportedLanguage,
  remoteEnabled: boolean,
): {
  local: FoodItem[];
  /** v11-B: the kept brand of each saved food in `local`, by its id. */
  brands: Readonly<Record<string, string>>;
  remote: FoodSearchResult[];
  remoteStatus: RemoteSearchStatus;
} {
  const trimmed = query.trim();
  const bundled = useMemo(
    () => (trimmed ? searchFoodsForDisplay(trimmed, language).slice(0, MAX_LOCAL) : []),
    [language, trimmed],
  );
  // Each answer is kept with the query it answers; a newer query simply does
  // not match it, so nothing is reset synchronously in an effect.
  const [saved, setSaved] = useState<{
    query: string;
    foods: FoodItem[];
    brands: Record<string, string>;
  }>({ query: '', foods: [], brands: {} });
  const [answer, setAnswer] = useState<{
    query: string;
    results: FoodSearchResult[];
    status: RemoteSearchStatus;
  }>({ query: '', results: [], status: 'idle' });
  // Bumped when a server answer filled in a saved food's brand (v11-B backfill).
  const [brandsFilled, setBrandsFilled] = useState(0);
  const remoteActive = remoteEnabled && trimmed.length >= REMOTE_MIN_CHARS;

  useEffect(() => {
    if (!trimmed) return;
    let current = true;
    searchSavedFoods(trimmed)
      .then((foods) => {
        if (!current) return;
        const brands: Record<string, string> = {};
        for (const food of foods) if (food.brand) brands[food.catalogKey] = food.brand;
        setSaved({ query: trimmed, foods: foods.map(foodItemFromCanonical), brands });
      })
      // Web has no local database (ADR-P019): only the bundled catalogue.
      .catch(() => {
        if (current) setSaved({ query: trimmed, foods: [], brands: {} });
      });
    return () => {
      current = false;
    };
  }, [trimmed, brandsFilled]);

  useEffect(() => {
    if (!remoteActive) return;
    let current = true;
    const timer = setTimeout(() => {
      searchRemoteFoods(trimmed)
        .then((response) => {
          if (!current) return;
          setAnswer({
            query: trimmed,
            results: response.results,
            status: response.external === 'ok' ? 'ok' : response.external,
          });
          // v11-B: a saved food without a brand takes the one the server reports.
          rememberBrands(response.results)
            .then((changed) => {
              if (current && changed > 0) setBrandsFilled((n) => n + 1);
            })
            .catch((error: unknown) => logError('nutrition.foodSearch.rememberBrands', error));
        })
        .catch((error: unknown) => {
          if (!current) return;
          setAnswer({
            query: trimmed,
            results: [],
            status: error instanceof FoodSearchOfflineError ? 'offline' : 'error',
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [remoteActive, trimmed]);

  const savedFoods = saved.query === trimmed ? saved.foods : [];
  const brands = saved.query === trimmed ? saved.brands : {};
  const answered = remoteActive && answer.query === trimmed;
  const remote = answered ? answer.results : [];
  const remoteStatus: RemoteSearchStatus = !remoteActive
    ? 'idle'
    : answered
      ? answer.status
      : 'loading';

  // Plain derivations: the React Compiler memoizes them (app.json).
  const bundledKeys = new Set(bundled.map((food) => food.id));
  const local = [...bundled, ...savedFoods.filter((food) => !bundledKeys.has(food.id))].slice(
    0,
    MAX_LOCAL,
  );
  const localKeys = new Set(local.map((food) => food.id));
  const shownRemote = remote.filter((result) => !localKeys.has(result.sourceId));

  return { local, brands, remote: shownRemote, remoteStatus };
}
