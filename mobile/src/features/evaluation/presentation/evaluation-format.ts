/** `YYYY-MM-DD` shifted by whole years; 29 February falls back to the 28th. */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` shifted by whole days. */
export function addDaysTo(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A calendar date as a Date at local noon, safe for formatting in any zone. */
export function calendarDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
