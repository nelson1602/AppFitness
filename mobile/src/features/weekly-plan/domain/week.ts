import { isoWeekStart } from '@/features/icoach/domain/progress-analysis';

/**
 * Calendar-week helpers for the saved plan (ADR-P042). Dates are `YYYY-MM-DD`
 * calendar dates, handled at UTC midnight in whole days, so no time zone can
 * shift a day. Monday starts the week.
 */
export { isoWeekStart as weekStartOf };

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The 7 dates of the week starting at `weekStart` (a Monday). */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Monday = 0 … Sunday = 6. */
export function dayIndexInWeek(date: string): number {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return (dow + 6) % 7;
}

export function previousWeekStart(weekStart: string): string {
  return addDays(weekStart, -7);
}
