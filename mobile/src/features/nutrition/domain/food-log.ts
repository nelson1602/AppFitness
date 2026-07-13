/**
 * Food-logging domain (ADR-P012 Slice 4C).
 *
 * Pure types + derivations for the local-first food log. The log records
 * what the user actually ate as MealItems carrying an immutable per-serving
 * snapshot (Slice 4A); consumed macros are DERIVED from that snapshot ×
 * `servingCount`, never recomputed from the read-only nutrition plan and
 * never stored redundantly.
 *
 * Identity: the log UI works in catalog keys/slugs, but persisted/synced
 * identity is the UUIDv5 food id + revision (Slice 4A). `foodId` below is
 * that UUIDv5; `catalogKey` is the human-facing slug carried in the snapshot.
 */

import type { MealTypeName } from '@/shared/infrastructure/database/types';

import { consumedTotals, type ServingSnapshot } from './catalog-identity';

/** Macros a logged item (or a day) actually contributed. */
export interface ConsumedMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Null when the food has no authored fiber value (never fabricated). */
  fiberG: number | null;
}

/**
 * Local sync state surfaced to the log UI, derived from the item's queued
 * sync operation — NOT a health value:
 * - `pending`  : queued / retrying (includes retryable DEPENDENCY_NOT_READY)
 * - `action_required` : terminal, needs the user (CATALOG_REVISION_UNSUPPORTED
 *                       or a version conflict) — never silently discarded
 * - `synced`   : acknowledged by the server
 */
export type MealItemSyncState = 'pending' | 'action_required' | 'synced';

/** One logged food within a meal, with its derived consumed macros. */
export interface LoggedMealItem {
  id: string;
  mealType: MealTypeName;
  /** UUIDv5 catalog food id (persisted/synced identity). */
  foodId: string;
  /** Catalog slug from the snapshot (human-facing identity). */
  catalogKey: string | null;
  name: string;
  /** Editable quantity model (Slice 4A): multiples of one catalog serving. */
  servingCount: number;
  serving: { amount: number; unit: string };
  consumed: ConsumedMacros;
  syncState: MealItemSyncState;
}

/** The whole day's log for one user/date, with derived totals. */
export interface DailyFoodLog {
  date: string;
  items: LoggedMealItem[];
  totals: ConsumedMacros;
}

/** Input for logging one catalog food against a meal on a date. */
export interface LogFoodInput {
  date: string;
  mealType: MealTypeName;
  /** Catalog slug (mapped to the UUIDv5 id + snapshot by the repository). */
  catalogKey: string;
  servingCount: number;
}

const ZERO_TOTALS: ConsumedMacros = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: null,
};

/** Consumed macros for one snapshot × serving count (delegates to Slice 4A). */
export function itemConsumed(snapshot: ServingSnapshot, servingCount: number): ConsumedMacros {
  return consumedTotals(snapshot, servingCount);
}

/**
 * Sum a day's logged items into consumed totals. Pure and order-independent.
 * Fiber stays null until at least one item carries fiber (never fabricated),
 * then only fiber-bearing items contribute.
 */
export function sumDailyTotals(items: readonly LoggedMealItem[]): ConsumedMacros {
  const round1 = (n: number): number => Math.round(n * 10) / 10;
  let hasFiber = false;
  const acc = items.reduce<ConsumedMacros>(
    (sum, item) => {
      if (item.consumed.fiberG != null) hasFiber = true;
      return {
        calories: sum.calories + item.consumed.calories,
        proteinG: sum.proteinG + item.consumed.proteinG,
        carbsG: sum.carbsG + item.consumed.carbsG,
        fatG: sum.fatG + item.consumed.fatG,
        fiberG: (sum.fiberG ?? 0) + (item.consumed.fiberG ?? 0),
      };
    },
    { ...ZERO_TOTALS },
  );
  return {
    calories: Math.round(acc.calories),
    proteinG: round1(acc.proteinG),
    carbsG: round1(acc.carbsG),
    fatG: round1(acc.fatG),
    fiberG: hasFiber ? round1(acc.fiberG ?? 0) : null,
  };
}
