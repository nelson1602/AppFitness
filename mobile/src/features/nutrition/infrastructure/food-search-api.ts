import { isSessionCurrent, refreshTokens, requireSessionSnapshot } from '@/features/authentication';

import type { CanonicalFood } from '../domain/catalog-identity';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Where a server search result comes from (v10 Block B, item 7). */
export type FoodSearchSource = 'catalog' | 'custom' | 'fdc' | 'off';

/** One server search result, per its own serving (100 g for external sources). */
export interface FoodSearchResult {
  source: FoodSearchSource;
  sourceId: string;
  /** Set when the food is already in the shared catalogue (or is the caller's own). */
  foodId: string | null;
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

export interface FoodSearchResponse {
  results: FoodSearchResult[];
  /** Whether USDA FoodData Central and Open Food Facts both answered. */
  external: 'ok' | 'partial' | 'unavailable';
}

export interface CustomFoodInput {
  name: string;
  servingAmount: number;
  servingUnit: 'g' | 'ml' | 'piece';
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

/** The phone could not reach the server: show local results only. */
export class FoodSearchOfflineError extends Error {
  constructor() {
    super('food search offline');
    this.name = 'FoodSearchOfflineError';
  }
}

/** The server answered with an error (code only, never the response body). */
export class FoodSearchRequestError extends Error {
  constructor(readonly status: number) {
    super(`food search request failed: ${status}`);
    this.name = 'FoodSearchRequestError';
  }
}

/**
 * One authenticated request, rotating an expired access token once and
 * retrying with the rotated token for the same account.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const owner = requireSessionSnapshot();
  const send = (token: string): Promise<Response> =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
  let response: Response;
  try {
    response = await send(owner.accessToken);
    if (response.status === 401 && isSessionCurrent(owner)) {
      const rotated = await refreshTokens();
      if (!rotated || rotated.user.id !== owner.userId) throw new FoodSearchRequestError(401);
      response = await send(rotated.accessToken);
    }
  } catch (error) {
    if (error instanceof FoodSearchRequestError) throw error;
    throw new FoodSearchOfflineError();
  }
  if (!response.ok) throw new FoodSearchRequestError(response.status);
  return (await response.json()) as T;
}

/** Searches the shared catalogue, USDA FoodData Central and Open Food Facts. */
export function searchRemoteFoods(query: string, limit = 15): Promise<FoodSearchResponse> {
  const params = `q=${encodeURIComponent(query.trim())}&limit=${limit}`;
  return request<FoodSearchResponse>(`/foods/search?${params}`);
}

/**
 * Saves a chosen USDA / Open Food Facts result into the shared catalogue. The
 * server re-fetches it from the source; the phone never sends nutrition values.
 */
export function importRemoteFood(source: 'fdc' | 'off', sourceId: string): Promise<CanonicalFood> {
  return request<CanonicalFood>('/foods/import', {
    method: 'POST',
    body: JSON.stringify({ source, sourceId }),
  });
}

/** Creates the person's own food (private to them) when nothing was found. */
export function createCustomFood(input: CustomFoodInput): Promise<CanonicalFood> {
  return request<CanonicalFood>('/foods/custom', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
