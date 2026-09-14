import type { ConflictFieldKind, ConflictFieldValue } from '@/shared/infrastructure/sync';
import {
  formatDate,
  formatNumber,
  type SupportedLanguage,
  type TranslationKey,
} from '@/shared/localization';

import { VALUE_STATE } from './conflict-copy';
import { resolveTerm, vocabularyFor } from './conflict-vocabulary';

/**
 * Turns one side of a field comparison into something renderable — ADR-P030
 * **C-6**.
 *
 * Three shapes, because three different things have to be said. A `key` is copy
 * the catalogue owns (a value exists and is not shown; this side carries none;
 * yes; no; nothing recorded; a controlled value's own word). `keys` is a list of
 * those, for a token field. A `text` is a value only the data can supply — a
 * number, a date, a localized food name, or prose the user wrote themselves.
 *
 * The presenter has already decided what may be seen (ADR-P030 §Decision 2) and
 * `conflict-vocabulary.ts` decides how a stored value becomes words. This module
 * only sequences them, and **fails closed**: anything that cannot be said
 * honestly becomes the withheld phrase rather than a raw identifier.
 */
export type RenderedValue =
  | { readonly kind: 'key'; readonly key: TranslationKey }
  | { readonly kind: 'keys'; readonly keys: readonly TranslationKey[] }
  | { readonly kind: 'text'; readonly text: string };

/** Separator between token values. Punctuation, not copy. */
const LIST_SEPARATOR = ', ';

/** Nothing honest can be said about this value, so its existence is all we say. */
const WITHHELD: RenderedValue = { kind: 'key', key: VALUE_STATE.hidden };

/** Field kinds whose stored form is an identifier unless proven otherwise. */
const TERM_KINDS: readonly ConflictFieldKind[] = ['text', 'enum', 'tokens'];

/**
 * A stored `YYYY-MM-DD` names a calendar day, not an instant. Parsing it as
 * local midnight keeps it on that day in every timezone — the same pairing the
 * Progress surface uses (BUG-013).
 */
function parseLocalDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInstant(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function renderTokens(
  field: string,
  tokens: readonly string[],
  language: SupportedLanguage,
): RenderedValue {
  if (tokens.length === 0) return { kind: 'key', key: 'sync.conflicts.value.notRecorded' };

  const resolved = tokens.map((token) => resolveTerm(field, token, language));
  // One unmapped token withholds the whole list: a partially translated list
  // would silently present the rest of the identifiers as if they were words.
  if (resolved.some((term) => term === null)) return WITHHELD;

  const terms = resolved as Exclude<(typeof resolved)[number], null>[];
  if (terms.every((term) => term.kind === 'key')) {
    return { kind: 'keys', keys: terms.map((term) => (term as { key: TranslationKey }).key) };
  }
  return {
    kind: 'text',
    text: terms.map((term) => (term.kind === 'text' ? term.text : '')).join(LIST_SEPARATOR),
  };
}

function renderTerm(
  field: string,
  raw: string | number | boolean | readonly string[],
  language: SupportedLanguage,
): RenderedValue {
  if (Array.isArray(raw)) return renderTokens(field, raw, language);
  const term = resolveTerm(field, raw, language);
  return term === null ? WITHHELD : term;
}

function renderTemporal(
  raw: string | number | boolean | readonly string[],
  kind: ConflictFieldKind,
  language: SupportedLanguage,
): RenderedValue {
  const text = String(raw);
  const parsed = kind === 'date' ? parseLocalDate(text) : parseInstant(text);
  if (!parsed) return WITHHELD;
  const options: Intl.DateTimeFormatOptions =
    kind === 'date'
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return { kind: 'text', text: formatDate(parsed, language, options) };
}

export function renderValue(
  value: ConflictFieldValue,
  field: string,
  kind: ConflictFieldKind,
  language: SupportedLanguage,
): RenderedValue {
  // `hidden` and `absent` are different facts and stay different: one says a
  // value exists and is withheld, the other that this side carries none.
  if (value.state !== 'value') return { kind: 'key', key: VALUE_STATE[value.state] };

  // A version or revision identifier is never shown, whatever its kind — the
  // one numeric field caught by this is `food_revision_snapshot`.
  if (vocabularyFor(field)?.kind === 'internal') return WITHHELD;

  // A present-but-empty value is neither withheld nor absent — it is a real,
  // blank answer, and it has its own words.
  if (value.value === null) return { kind: 'key', key: 'sync.conflicts.value.notRecorded' };

  const raw = value.value;

  // Identifier-shaped kinds go through the vocabulary or not at all. An
  // unclassified one fails closed rather than printing its stored form.
  if (TERM_KINDS.includes(kind)) {
    return vocabularyFor(field) === null ? WITHHELD : renderTerm(field, raw, language);
  }

  if (typeof raw === 'boolean') {
    return { kind: 'key', key: raw ? 'sync.conflicts.value.yes' : 'sync.conflicts.value.no' };
  }
  if (kind === 'number') {
    return typeof raw === 'number' ? { kind: 'text', text: formatNumber(raw, language) } : WITHHELD;
  }
  return renderTemporal(raw, kind, language);
}

/**
 * The record's own date and the moment the divergence was noticed — metadata
 * (§Decision 2), not allow-listed field values, so they carry no vocabulary and
 * are formatted directly. An unparseable one is returned unchanged rather than
 * guessed at; both come from columns the client itself wrote.
 */
export function formatCalendarDate(iso: string, language: SupportedLanguage): string {
  const parsed = parseLocalDate(iso);
  return parsed
    ? formatDate(parsed, language, { year: 'numeric', month: 'short', day: 'numeric' })
    : iso;
}

export function formatInstant(iso: string, language: SupportedLanguage): string {
  const parsed = parseInstant(iso);
  return parsed
    ? formatDate(parsed, language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : iso;
}
