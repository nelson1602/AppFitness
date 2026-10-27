/**
 * Pure date helpers for {@link DateField} (ADR-P043). Values are stored as
 * calendar dates, `YYYY-MM-DD`, with no time and no time zone: every
 * conversion uses the local calendar fields, so a date never shifts by a day
 * across time zones.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A valid `YYYY-MM-DD` calendar date as a local-midnight Date, else null. */
export function isoToLocalDate(iso: string | null | undefined): Date | null {
  const match = iso ? ISO_DATE.exec(iso) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Reject roll-overs such as 2026-02-30.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** The local calendar date of `date` as `YYYY-MM-DD`. */
export function localDateToIso(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** DD/MM/AAAA in Spanish, MM/DD/YYYY in English; '' for a missing value. */
export function formatIsoForDisplay(iso: string | null | undefined, language: 'es' | 'en'): string {
  const match = iso ? ISO_DATE.exec(iso) : null;
  if (!match) return '';
  const [, year, month, day] = match;
  return language === 'es' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

/** The field's empty-state pattern, in the language's order. */
export function datePattern(language: 'es' | 'en'): string {
  return language === 'es' ? 'DD/MM/AAAA' : 'MM/DD/YYYY';
}
