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
/** The weekly-plan conflict labels (v8 Block 2, ADR-P042), tabulated in the deck. */
const ADDED_BY_V8 = [
  'sync.conflicts.record.weekly_plans',
  'sync.conflicts.field.effective_from',
  'sync.conflicts.field.generation_trigger',
  'sync.conflicts.field.load_step',
  'sync.conflicts.field.revision',
  'sync.conflicts.value.planTrigger.firstRun',
  'sync.conflicts.value.planTrigger.weekly',
  'sync.conflicts.value.planTrigger.change',
];

/** v8.1: the profile's country field, tabulated in the deck. */
const ADDED_BY_V81 = ['sync.conflicts.field.country'];

const REMOVED_BY_C6 = ['sync.conflicts.actionNeededTitle', 'sync.conflicts.actionNeededBody'];

describe('the approved C-5 deck reaches both catalogues unchanged', () => {
  const tabulated = approvedRows();
  const rows = tabulated.filter(
    (row) =>
      !ADDED_BY_C6.includes(row.key) &&
      !ADDED_BY_V8.includes(row.key) &&
      !ADDED_BY_V81.includes(row.key),
  );

  it('tabulates 166 rows — 150 surviving C-5 rows, the 7 C-6 added, 8 for v8 and 1 for v8.1', () => {
    expect(tabulated).toHaveLength(166);
    expect(rows).toHaveLength(150);
    expect(new Set(tabulated.map((row) => row.key)).size).toBe(166);
    expect(tabulated.map((row) => row.key)).toEqual(expect.arrayContaining(ADDED_BY_V8));
    expect(tabulated.map((row) => row.key)).toEqual(expect.arrayContaining(ADDED_BY_V81));
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
    expect(shipped).toHaveLength(166);
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
  // `progress.measurements.datePlaceholder`. It moved again to 1067 on
  // 2026-09-16, when BUG-016 added the Web document title and the three
  // not-found keys. It moved to 1068 on 2026-09-28, when BUG-027 added the
  // persistent dietary-note helper `nutrition.preferences.noteHelper`. It moved
  // to 1138 on 2026-09-30, when ADR-P034 S-3 added the 68-key `subscription.*`
  // family and the 2-key dashboard subscription entry. It moved to 1143 on
  // 2026-10-01, when ADR-P034 S-4 added five read-only access keys. It moved
  // to 1142 on 2026-10-08, when BUG-033 removed `auth.switchMode`: the sign-in
  // mode button now takes its name from its visible text. It moved to 1144 on
  // 2026-10-21, when the visual pilot removed the device-language label and
  // added three dashboard group headings. It moved to 1152 on 2026-10-22, when
  // the ADR-P035 sign-in added the brand name, the split headline, the short
  // forgot link, "New here?" and the show/hide password names. It moved to
  // 1214 on 2026-10-23, when ADR-P039 added 69 keys (tabs, header,
  // notifications, Inicio, welcome and the Workouts Web state) and removed
  // seven dashboard keys the tab shell left unreachable (the hero subtitle, two
  // group headings and the Nutrition and Progress shortcuts). It moved to 1258
  // on 2026-10-25 with the prototype-fidelity pass: 51 keys for Inicio's
  // evaluation card, notification times and the four tabs, minus 7 that the
  // pass left unreachable. It moved to 1265 on 2026-10-26, when the store
  // screenshot review added a short goal name per goal type (goal.typeShort.*)
  // so Inicio's goal card keeps the weight whole. v8 then added, in order:
  // ADR-P041's password checklist and "Verify your email" step (+21 net, 1286);
  // labels for the three new injury values (+3, 1289); four avoid-tag labels
  // and the allergy-block write error (+6, 1295); the DateField copy (+3,
  // 1298); the weekly-plan conflict labels (+8, 1306, in the family below); and
  // the weekly plan's screens — saved week and preview (+11), the "renews on
  // Monday" chip (+1), the change prompt (+9) and "Semanas anteriores" (+32),
  // reaching 1359; then the Evaluación física wizard and "Creando tu plan
  // personal" (+221, 1580); and the development-only sample-weeks button
  // (+1, 1581); and the note when the engine caps the chosen training days
  // (+1, 1582); the training-days progression prompt and history note
  // (+2, 1584); the plural unit names (+3, 1587); the restyled meal plan (+8 new, -3 no longer shown, 1592); the restyled workout plan (+6 new, -5 no longer shown, 1593); native date pickers on the remaining forms (+1, -5 placeholders, 1589); in-page titles that repeated the header (-6, 1583); the privacy-policy link (+2, 1585); the reset-password headline that repeated the header (-1, 1584); and the Salud hints that named conditions (-5, 1579).
  // v8.1 then added the birth-date wheel's Día / Mes / Año column names and its open hint (+4, 1583), the sync reasons and details on Perfil (+14, 1597), and the prototype Entrenamientos tab: set-by-set progress, rest timer, week status and the demo cues (+76, -4 no longer shown, 1669).
  // v8.1 then added the country — the País picker, its hint and 22 country names (+26), the
  // plan-change label (+1) and the conflict field label (+1, in the family below) — and the
  // Dominican dish plan: 44 dish names and the "(cambio del iCoach)" mark (+45), (+73 together, 1742).
  // v8.1 Progreso restored the prototype's panels: the weight chart, today's weight, the measurement tiles and the week's three stats (+27), replacing the log row and its detail (-2, 1767), and the prototype Nutrición tab: the ring, the macros, the foods off the plan, what the iCoach adjusted and the extras (+10, -2 no longer shown, 1775). v8.1 round 2: the exercise figure label (+1, 1776) and the dish-plan prompt sentence (+1, 1777).
  // v8.1 round 2 Perfil: the summary row label, the activity and stress chips and the Meta line's weekly workouts (+5, 1782).
  // v8.1 round 2: the everyday Dominican dishes with casabe, queso blanco and canela (+7, 1782), and the 15-day slider's hint (+1, 1783).
  // Merged total for v8.1 round 2: 1775 + 2 (figure label, dish-plan prompt) + 5 (Perfil) + 8 (dishes, slider hint) = 1790.
  // Then guineítos: two dish names and the "N guineítos · g" portion (one, many) (+4, 1794).
  // v10 Block A items 2–3: the plan start panel (title, body) and logging an earlier day (mark done, date note) (+4).
  // Items 5–6 (ADR-P040 Addendum v10-A): "Actividad extra" and its iCoach notes (+6),
  // the week's "+N extra" and the "+N kcal por actividad" bonus (+2), the iCoach card's latest
  // change (+4), "Guardar como rutina" (+3) and the new-targets prompt sentence (+1) (+16; 1814 together). R3 on the new day: moved from / moved to / log it here (+3, 1817). The iCoach headline once today is done (+1, 1818). v10 Block B item 7: server food search, its sources and states, and the custom food form (+25, 1843).
  // v10 Block B item 8: the exclusion picker drops "Seleccionado" (-1) and gains
  // "Ya excluido", "Alimentos excluidos" and "Quitar {food}" (+3) (+2; 1845 with item 7).
  // v10 Block C item 12: the retention step before deleting the account (+9) and the
  // Privacidad y datos screen (+4) (+13, 1858).
  // v10 Block C item 9: Unidades (title, two options, save error, inches, example) (+6), and the
  // imperial labels, errors and examples of each weight / length field (+16) (+22, 1880).
  // v10 Block C review: the singular "1 porción" / "1 serving" (+1, 1881).
  // ADR-P036 biometric sign-in (rebased for v10): the 20-key `auth.biometric.*` family (+20, 1901), then the Perfil Seguridad panel: its title, on/off, no-sensor and two enrol-in-settings lines (+6, 1907).
  // v10 402/413: the subscription-required notice (+3), the server-error sync problem (+2) and
  // the too-large row reason (+1), the food save offline lines (+2), the conflict settlement
  // server error (+2) and the verification check server error (+1), minus the old sync-paused
  // pair (-2) (+9, 1916).
  // v10-B real-time rebalancing: the meal and day lines, the light option, Omitir and the
  // over-target preview (+12), and the iCoach card's four rebalance sentences (+4) (+16, 1932).
  // fix-1: the struck-through "antes {kcal}" on a covered or skipped meal (+1, 1933).
  it('reaches 1933 keys in each language — 1745 shipped plus a 188-key family', () => {
    expect(Object.keys(en)).toHaveLength(1933);
    expect(Object.keys(es)).toHaveLength(1933);
    expect(Object.keys(en).filter((key) => key.startsWith('sync.conflicts.'))).toHaveLength(166);
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
