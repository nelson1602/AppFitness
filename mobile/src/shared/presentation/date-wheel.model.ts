/**
 * Pure model of {@link DateWheelPicker}: three columns (day, month, year) over
 * an inclusive `YYYY-MM-DD` range. Every change keeps the day inside the
 * month's length (leap years included) and the whole date inside the range,
 * so the wheel can never produce a date the range excludes.
 */

export type WheelPart = 'day' | 'month' | 'year';

interface CalendarParts {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

function parts(iso: string): CalendarParts {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function toIso({ year, month, day }: CalendarParts): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Days in `month` (1–12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampRange(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

/** `iso` inside [min, max]; an invalid or missing value becomes `fallback`. */
export function clampDate(
  iso: string | null | undefined,
  min: string,
  max: string,
  fallback: string,
): string {
  const valid = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : fallback;
  return clampRange(valid, min, max);
}

/** The values each column offers: every day of the month, all 12 months, the range's years. */
export function columnValues(value: string, min: string, max: string): Record<WheelPart, number[]> {
  const { year, month } = parts(value);
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);
  return {
    day: range(1, daysInMonth(year, month)),
    month: range(1, 12),
    year: range(parts(min).year, parts(max).year),
  };
}

/** The date's value in one column. */
export function partOf(value: string, part: WheelPart): number {
  return parts(value)[part];
}

/** `value` with one column set to `next`, the day clamped to the month and the date to the range. */
export function setPart(
  value: string,
  part: WheelPart,
  next: number,
  min: string,
  max: string,
): string {
  const updated = { ...parts(value), [part]: next };
  updated.day = Math.min(updated.day, daysInMonth(updated.year, updated.month));
  return clampRange(toIso(updated), min, max);
}

/** `value` moved one item up (+1) or down (−1) in a column, stopping at the column's ends. */
export function stepPart(
  value: string,
  part: WheelPart,
  delta: 1 | -1,
  min: string,
  max: string,
): string {
  const values = columnValues(value, min, max)[part];
  const index = values.indexOf(partOf(value, part));
  const nextIndex = Math.min(values.length - 1, Math.max(0, index + delta));
  return setPart(value, part, values[nextIndex], min, max);
}
