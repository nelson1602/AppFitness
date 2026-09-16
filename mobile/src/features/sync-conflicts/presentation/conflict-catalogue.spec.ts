import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

/**
 * The C-5 → C-6 import, checked against the approved deck itself — ADR-P030.
 *
 * C-5 is the authority on this wording, so the assertion is not "some
 * `sync.conflicts.*` keys exist" but "**exactly** the rows `.ai/19_COPY_DECKS.md`
 * approved, worded **exactly** as approved, in both languages". A reworded
 * string, a dropped row or an invented key all fail here.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `transaction-threading.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const DECK = `${__dirname}/../../../../../.ai/19_COPY_DECKS.md`;
const TICK = String.fromCharCode(96);

interface DeckRow {
  key: string;
  en: string;
  es: string;
}

function approvedRows(): DeckRow[] {
  const deck = require('node:fs').readFileSync(DECK, 'utf8').replace(/\r\n/g, '\n');
  const start = deck.indexOf('# Conflict resolution — ADR-P030 slice C-5');
  const end = deck.indexOf('# Deferred copy', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const rows: DeckRow[] = [];
  for (const line of deck.slice(start, end).split('\n')) {
    if (!line.startsWith(`| ${TICK}sync.conflicts.`)) continue;
    const cells = line
      .replace(/^\|\s*/, '')
      .replace(/\s*\|\s*$/, '')
      .split(' | ');
    rows.push({
      key: cells[0].trim().split(TICK).join(''),
      en: cells[1].trim(),
      es: cells[2].trim(),
    });
  }
  return rows;
}

/**
 * The one pair C-5 did not word: this surface's own ADR-P019 Web-unavailable
 * treatment. Every shipped Web-unavailable surface owns a title/body pair and
 * C-5 worded none for `/sync-conflicts`, so C-6 added them. Two more corrected
 * C-5 gaps of a different kind: a write failure and a read failure are not the
 * same event, and the value copy this surface needs is its own rather than the
 * Progress family's. All five are tabulated in the deck under their own
 * headings and excluded from the C-5 count everywhere below.
 */
const ADDED_BY_C6 = [
  'sync.conflicts.webUnavailableTitle',
  'sync.conflicts.webUnavailableBody',
  'sync.conflicts.choiceErrorTitle',
  'sync.conflicts.choiceErrorBody',
  'sync.conflicts.value.yes',
  'sync.conflicts.value.no',
  'sync.conflicts.value.notRecorded',
];

/**
 * C-5 over-assigned the A-8 catalog-revision park to this family. It is not a
 * version conflict, C-4's service does not expose it, and the Food Log already
 * owns its shipped actionable treatment — so C-6 removed the two keys rather
 * than broadening the surface or bypassing the service to reach the queue.
 */
const REMOVED_BY_C6 = ['sync.conflicts.actionNeededTitle', 'sync.conflicts.actionNeededBody'];

describe('the approved C-5 deck reaches both catalogues unchanged', () => {
  const tabulated = approvedRows();
  const rows = tabulated.filter((row) => !ADDED_BY_C6.includes(row.key));

  it('tabulates 157 rows — 150 surviving C-5 rows plus the 7 C-6 added', () => {
    expect(tabulated).toHaveLength(157);
    expect(rows).toHaveLength(150);
    expect(new Set(tabulated.map((row) => row.key)).size).toBe(157);
  });

  it('tabulates every key C-6 added, separately from the C-5 family', () => {
    expect(tabulated.map((row) => row.key)).toEqual(expect.arrayContaining(ADDED_BY_C6));
  });

  it('no longer tabulates the action-needed pair', () => {
    expect(tabulated.map((row) => row.key)).toEqual(expect.not.arrayContaining(REMOVED_BY_C6));
  });

  it('carries every approved English string verbatim', () => {
    const catalogue = en as Record<string, string>;
    for (const row of rows) expect(catalogue[row.key]).toBe(row.en);
  });

  it('carries every approved Spanish string verbatim', () => {
    const catalogue = es as Record<string, string>;
    for (const row of rows) expect(catalogue[row.key]).toBe(row.es);
  });

  it('adds no `sync.conflicts.*` key the deck does not tabulate', () => {
    const approved = new Set(tabulated.map((row) => row.key));
    const shipped = Object.keys(en).filter((key) => key.startsWith('sync.conflicts.'));
    expect(shipped.filter((key) => !approved.has(key))).toEqual([]);
    expect(shipped).toHaveLength(157);
  });

  it('ships neither action-needed key in either catalogue', () => {
    for (const key of REMOVED_BY_C6) {
      expect(Object.keys(en)).not.toContain(key);
      expect(Object.keys(es)).not.toContain(key);
    }
  });
});

describe('catalogue parity', () => {
  it('keeps EN and ES on the same key set', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  // The total moved from 1061 to 1063 on 2026-09-15: the bilingual surface
  // audit added `profile.birthDatePlaceholder` and
  // `progress.measurements.datePlaceholder`, neither in this family, so the
  // 157-key conflict family below is unchanged.
  it('reaches 1063 keys in each language — 906 shipped plus a 157-key family', () => {
    expect(Object.keys(en)).toHaveLength(1063);
    expect(Object.keys(es)).toHaveLength(1063);
    expect(Object.keys(en).filter((key) => key.startsWith('sync.conflicts.'))).toHaveLength(157);
  });

  it('translates every added key, bar the words that are the same in both', () => {
    const english = en as Record<string, string>;
    const spanish = es as Record<string, string>;
    // "No" is "No". Distorting Spanish to make the strings differ would be a
    // worse translation, not a better one.
    const IDENTICAL_BY_NATURE = ['sync.conflicts.value.no'];
    const untranslated = Object.keys(english)
      .filter((key) => key.startsWith('sync.conflicts.'))
      .filter((key) => english[key] === spanish[key])
      .filter((key) => !IDENTICAL_BY_NATURE.includes(key));
    expect(untranslated).toEqual([]);
  });
});
