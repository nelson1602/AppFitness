import { es } from './i18n/es';

// Keeps "50,0 %" on one line; built from its code point so the source holds
// no invisible character.
const NBSP = String.fromCharCode(0xa0);

const dateTime = new Intl.DateTimeFormat('es', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateOnly = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const number = new Intl.NumberFormat('es');

const oneDecimal = new Intl.NumberFormat('es', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return es.common.dash;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

/** Formats a calendar day `YYYY-MM-DD` (no time zone shift). */
export function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateOnly.format(date);
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatPercent(value: number): string {
  return `${oneDecimal.format(value)}${NBSP}%`;
}

/** Groups a base32 secret in blocks of four for manual entry. */
export function groupSecret(secret: string): string {
  return (
    secret
      .replace(/\s+/g, '')
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return es.audit.none;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Circular or BigInt payloads cannot be serialised; show a placeholder.
    return es.audit.unreadable;
  }
}
