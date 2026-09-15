import { en } from './resources/en';
import { es } from './resources/es';

/**
 * Surface coverage for the bilingual catalogues — `.ai/21_BILINGUAL_SURFACE_AUDIT.md`.
 *
 * EN/ES key parity is necessary and **not sufficient**: a key can exist in both
 * languages and still never reach the user, and a surface can render a stored
 * token, a literal, or an English fallback while parity stays perfect. This
 * spec pins the four things the audit proved, so none of them can regress
 * silently:
 *
 *  1. the two catalogues stay a byte-for-byte key match, with no empty value
 *     and no placeholder token on one side only;
 *  2. every catalogue key is reachable — either referenced literally by
 *     production source, or produced by one of the **documented** dynamic
 *     families below, which must stay total over their domains;
 *  3. no public-v1 surface assigns a literal string to a rendered or announced
 *     prop, and no public-v1 surface renders a stored identifier where the
 *     shipped vocabulary already has a label;
 *  4. the English fallbacks that exist by design stay unreachable, because the
 *     maps in front of them stay total over what their producers emit.
 *
 * It reads source rather than importing it wherever the thing under test is a
 * private constant or a union type — the same idiom as
 * `conflict-vocabulary.spec.ts`, and for the same reason: the assertion has to
 * be about what the repository actually ships, not about a copy of it.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `conflict-catalogue.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const fs = require('node:fs');
/** `mobile/src`, forward-slashed so paths read the same on every platform. */
const SRC = __dirname.replace(/\\/g, '/').replace(/\/shared\/localization$/, '');

const english = en as Record<string, string>;
const spanish = es as Record<string, string>;
const KEYS = Object.keys(english);

/** Every shipped source file, excluding tests and the catalogues themselves. */
function productionFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (fs.statSync(full).isDirectory()) {
        if (entry === 'tests' || entry === 'testing') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.spec\.tsx?$/.test(entry)) continue;
      if (full.includes('/localization/resources/')) continue;
      out.push(full);
    }
  };
  walk(SRC);
  return out;
}

const FILES = productionFiles();
const SOURCE = new Map(FILES.map((file) => [file, fs.readFileSync(file, 'utf8')]));

/** Public v1 only: the medical domain is dormant under ADR-P017 and keeps its
 * hardcoded English until a future, separately approved reactivation. */
const isDormantMedical = (file: string): boolean => file.includes('/features/medical/');

const relative = (file: string): string => `src${file.slice(SRC.length)}`;

/**
 * Keys no production file names as a literal. Each entry is either built at
 * runtime from a closed domain (asserted total below) or a recorded orphan.
 */
const NOT_REFERENCED_LITERALLY: Readonly<Record<string, string>> = {
  'dashboard.bmi.underweight': 'built from BmiCategory',
  'dashboard.bmi.normal': 'built from BmiCategory',
  'dashboard.bmi.overweight': 'built from BmiCategory',
  'dashboard.bmi.obese': 'built from BmiCategory',
  'dashboard.intensity.low': 'built from Intensity',
  'dashboard.intensity.moderate': 'built from Intensity',
  'dashboard.intensity.high': 'built from Intensity',
  'dashboard.recommendation.category.safety': 'built from RecommendationCategory',
  'dashboard.recommendation.category.nutrition': 'built from RecommendationCategory',
  'dashboard.recommendation.category.training': 'built from RecommendationCategory',
  'dashboard.recommendation.category.recovery': 'built from RecommendationCategory',
  'dashboard.recommendation.category.body': 'built from RecommendationCategory',
  'dashboard.recommendation.priority.low': 'built from RecommendationPriority',
  'dashboard.recommendation.priority.medium': 'built from RecommendationPriority',
  'dashboard.recommendation.priority.high': 'built from RecommendationPriority',
  'dashboard.recommendation.priority.critical': 'built from RecommendationPriority',
  // Recorded orphan. The conflict card names a record by its kind in the
  // title (`sync.conflicts.record.*`), so this metadata label is catalogued
  // and never rendered. `.ai/19_COPY_DECKS.md` records it as such.
  'sync.conflicts.meta.record': 'catalogued, deliberately not rendered',
};

/** A `'literal'` occurrence of the key anywhere in production source. */
function referencedLiterally(key: string): boolean {
  const quoted = `'${key}'`;
  for (const text of SOURCE.values()) if (text.includes(quoted)) return true;
  return false;
}

/** Members of a single-line string-union type alias, read from source. */
function unionMembers(file: string, alias: string): string[] {
  const text = fs.readFileSync(`${SRC}/${file}`, 'utf8');
  const line = text.split('\n').find((candidate) => candidate.includes(`type ${alias} =`));
  if (!line) throw new Error(`union ${alias} not found in ${file}`);
  return [...line.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

describe('catalogue parity', () => {
  it('ships the same key set in both languages', () => {
    expect(Object.keys(spanish).sort()).toEqual(KEYS.slice().sort());
  });

  it('has a non-empty value for every key in both languages', () => {
    const blank = KEYS.filter((key) => english[key].trim() === '' || spanish[key].trim() === '');
    expect(blank).toEqual([]);
  });

  it('uses the Spanish date format wherever the English one is a date placeholder', () => {
    // Five form fields hint the accepted date shape. The Spanish validation
    // messages say AAAA-MM-DD, so a placeholder that still said YYYY-MM-DD
    // contradicted the error the same field produces.
    const dateKeys = KEYS.filter((key) => english[key] === 'YYYY-MM-DD');
    expect(dateKeys.length).toBeGreaterThanOrEqual(5);
    expect(dateKeys.filter((key) => spanish[key] !== 'AAAA-MM-DD')).toEqual([]);
  });

  it('carries the same substitution tokens on both sides of every key', () => {
    const tokensOf = (value: string): string[] =>
      [...new Set(value.match(/\{[a-zA-Z]+\}/g) ?? [])].sort();
    const mismatched = KEYS.filter(
      (key) => tokensOf(english[key]).join(',') !== tokensOf(spanish[key]).join(','),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('every catalogue key is reachable', () => {
  it('reads a non-trivial production file list', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(200);
  });

  it('names every key literally, except the documented dynamic and orphan set', () => {
    const unreferenced = KEYS.filter((key) => !referencedLiterally(key)).sort();
    expect(unreferenced).toEqual(Object.keys(NOT_REFERENCED_LITERALLY).sort());
  });

  it.each([
    ['BmiCategory', 'features/icoach/domain/types.ts', 'dashboard.bmi.'],
    ['Intensity', 'features/icoach/domain/types.ts', 'dashboard.intensity.'],
    [
      'RecommendationCategory',
      'features/icoach/domain/types.ts',
      'dashboard.recommendation.category.',
    ],
    [
      'RecommendationPriority',
      'features/icoach/domain/types.ts',
      'dashboard.recommendation.priority.',
    ],
  ])('resolves every %s member to a key in both languages', (alias, file, prefix) => {
    const members = unionMembers(file, alias);
    expect(members.length).toBeGreaterThan(0);
    const missing = members
      .map((member) => `${prefix}${member.toLowerCase()}`)
      .filter((key) => english[key] === undefined || spanish[key] === undefined);
    expect(missing).toEqual([]);
  });

  it('resolves every ServingUnit to a key in both languages', () => {
    const units = unionMembers('features/nutrition/domain/food-catalog.ts', 'ServingUnit');
    expect(units).toContain('piece');
    const missing = units
      .map((unit) => `nutrition.unit.${unit}`)
      .filter((key) => english[key] === undefined || spanish[key] === undefined);
    expect(missing).toEqual([]);
  });
});

describe('no public-v1 surface renders an unlocalized string', () => {
  /** Props whose string value is rendered on screen or announced by AT. */
  const TEXT_PROPS = [
    'accessibilityLabel',
    'accessibilityHint',
    'accessibilityValue',
    'placeholder',
    'title',
    'label',
  ];
  const LITERAL_PROP = new RegExp(`\\b(${TEXT_PROPS.join('|')})=(?:"|\\{')`, 'g');

  /**
   * `TrainingPlanCard` is an unreachable leftover: it carries hardcoded English
   * and medical framing that ADR-P017 and `00_PROJECT.md` §Non-Goals exclude
   * from public v1, and no production module imports it. It is exempt only for
   * as long as that stays true — the next test is what enforces it.
   */
  const EXEMPT = ['features/workout/presentation/TrainingPlanCard.tsx'];

  it('assigns no literal string to a rendered or announced prop', () => {
    const offenders: string[] = [];
    for (const [file, text] of SOURCE) {
      if (isDormantMedical(file)) continue;
      if (EXEMPT.some((exempt) => file.endsWith(exempt))) continue;
      LITERAL_PROP.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = LITERAL_PROP.exec(text))) {
        offenders.push(`${relative(file)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the exempt surface unreachable from any production module', () => {
    const importers = [...SOURCE]
      .filter(([file]) => !file.endsWith('TrainingPlanCard.tsx'))
      .filter(([, text]) => text.includes('TrainingPlanCard'))
      .map(([file]) => relative(file));
    expect(importers).toEqual([]);
  });

  it('resolves the logged serving unit through the catalogue, never the stored token', () => {
    const screen = [...SOURCE].find(([file]) => file.endsWith('presentation/FoodLogScreen.tsx'));
    expect(screen).toBeDefined();
    const text = screen![1];
    expect(text).toContain('const unitKey = UNIT_LABEL[item.serving.unit];');
    expect(text).toContain('{unitKey ? t(unitKey) : item.serving.unit}');
  });
});

describe('the English fallbacks that exist by design stay unreachable', () => {
  /**
   * `DataGapCard` falls back to the requirement's own English `title`/`detail`
   * for an id it does not know — deliberate, and covered by its own spec. That
   * fallback must never fire in production, so the map has to stay total over
   * the ids the iCoach adapter actually emits.
   */
  it('maps every data-gap id the iCoach adapter emits', () => {
    const adapter = fs.readFileSync(
      `${SRC}/features/dashboard/application/icoach-adapter.ts`,
      'utf8',
    );
    const emitted = [...adapter.matchAll(/^\s+id: '([^']+)',$/gm)].map((match) => match[1]);
    expect(emitted.length).toBeGreaterThanOrEqual(6);

    const card = fs.readFileSync(
      `${SRC}/features/dashboard/presentation/components/data-gap-card.tsx`,
      'utf8',
    );
    const block = card.slice(card.indexOf('const GAP_COPY'), card.indexOf('export function'));
    const unmapped = emitted.filter(
      (id) => !block.includes(`${id}:`) && !block.includes(`'${id}'`),
    );
    expect(unmapped).toEqual([]);
  });

  /**
   * `resolveRecommendationCopy` falls through to the engine's raw English
   * strings for an unknown rule id. Public v1 never supplies `restrictions` or
   * `bloodPressure`, so the three `SAFETY:*` medical rules cannot fire; this
   * pins the input that makes that true.
   */
  it('keeps the iCoach adapter from feeding the dormant medical rules', () => {
    const adapter = fs.readFileSync(
      `${SRC}/features/dashboard/application/icoach-adapter.ts`,
      'utf8',
    );
    expect(adapter).toContain('restrictions: [],');
    expect(adapter).not.toContain('bloodPressure:');
  });
});
