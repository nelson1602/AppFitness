import type { MealSlot } from './meal-plan';

/**
 * A planned meal slot's status on one date (ADR-P040 Addendum BUG-056, S1).
 * Derived from the food log on every render, never stored, so deleting the
 * food that set it reopens the slot (S6).
 *
 * - `eaten`: "Lo comí" logged it (a plan-linked item, ADR-P042 item 6).
 * - `logged`: food logged under that meal outside the plan ("Registrado").
 * - `skipped`: "Omitir" for today (ADR-P040 v10-B B2).
 * - `pending`: none of the above; only these meals are rebalanced (S2).
 */
export type MealSlotStatus = 'eaten' | 'logged' | 'skipped' | 'pending';

/** The `date|slot` key used by the weekly plan's slot lists. */
export function slotKey(date: string, slot: MealSlot): string {
  return `${date}|${slot}`;
}

/** The `date|slot` keys of one day's food logged outside the plan. */
export function offPlanSlotKeys(
  date: string,
  items: readonly { mealType: string; planned?: boolean }[],
): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.planned) keys.add(slotKey(date, item.mealType as MealSlot));
  }
  return [...keys];
}

/**
 * The stored keys with one date's keys replaced by its live ones: the day the
 * food log has loaded is current on every log and delete, other days are as
 * the weekly plan last read them.
 */
export function withLiveDay(
  stored: readonly string[],
  date: string,
  live: readonly string[],
): string[] {
  return [...stored.filter((key) => !key.startsWith(`${date}|`)), ...live];
}

export interface SlotStatusInput {
  date: string;
  /** `date|slot` keys with a plan-linked item ("Lo comí"). */
  eaten: ReadonlySet<string>;
  /** `date|slot` keys with an item logged outside the plan. */
  logged: ReadonlySet<string>;
  /** Today's skipped slots ("Omitir"); [] on other days. */
  skipped: readonly MealSlot[];
}

/** S1, in precedence order: eaten, logged, skipped, pending. */
export function mealSlotStatus(input: SlotStatusInput, slot: MealSlot): MealSlotStatus {
  const key = slotKey(input.date, slot);
  if (input.eaten.has(key)) return 'eaten';
  if (input.logged.has(key)) return 'logged';
  if (input.skipped.includes(slot)) return 'skipped';
  return 'pending';
}

/** S2: the slots the rebalance leaves alone (every status but pending). */
export function closedMealSlots(input: SlotStatusInput, slots: readonly MealSlot[]): Set<MealSlot> {
  return new Set(slots.filter((slot) => mealSlotStatus(input, slot) !== 'pending'));
}
