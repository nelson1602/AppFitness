/**
 * Structural guard for the touch-target floor — **BUG-023**.
 *
 * `.ai/08_UI_UX.md` requires every interactive element to be at least 44×44.
 * `AppButton` enforces that for itself, but a feature can still hand-roll a
 * `<Pressable>`: four ad-hoc ones shipped under the floor (24–42 dp tall), and
 * a short `FormSelect` option ("Sí") measured 39.6 dp wide. A
 * rendered test can only check the sites it renders, so this file reads the
 * floor off the source instead: every production `<Pressable>` is listed below
 * with the reason it meets the contract, and a new one fails here until it is
 * classified — an undersized target cannot return silently.
 *
 * The precedent is `shared/theme/color-usage.source.spec.ts`.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `color-usage.source.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC = `${__dirname}/../..`;

function sourceFiles(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((entry: string) => {
    const path = `${dir}/${entry}`;
    if (fs.statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry) || /\.spec\.tsx?$/.test(entry)) return [];
    return [path];
  });
}

/** Repo-relative and forward-slashed, so a failure names a file on any OS. */
function repoRelative(absolute: string): string {
  const resolved: string[] = [];
  for (const segment of absolute.replace(/\\/g, '/').split('/')) {
    if (segment === '..') resolved.pop();
    else if (segment !== '.') resolved.push(segment);
  }
  const joined = resolved.join('/');
  return joined.slice(joined.indexOf('/src/') + 1);
}

interface PressableSite {
  /** The opening tag, props included. */
  tag: string;
  /** The whole element, children included. */
  element: string;
}

/**
 * Every `<Pressable …>…</Pressable>` in a file. The opening tag ends at the first
 * `>` outside braces, so arrow functions inside props (`() => …`) are skipped.
 */
function pressables(text: string): PressableSite[] {
  const sites: PressableSite[] = [];
  const opener = /<Pressable\b/g;
  for (let match = opener.exec(text); match; match = opener.exec(text)) {
    let depth = 0;
    let end = match.index;
    for (let i = match.index; i < text.length; i += 1) {
      const char = text[i];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    const close = text.indexOf('</Pressable>', end);
    sites.push({
      tag: text.slice(match.index, end + 1),
      element: text.slice(match.index, close === -1 ? end + 1 : close),
    });
  }
  return sites;
}

/**
 * How each site meets the floor:
 * - `floor`: `minHeight: theme.spacing.x5l`; its width is a full-width row, or
 *   a padded label whose narrowest EN/ES option was measured on the Android
 *   emulator at 48 dp or more (BUG-023). A site whose labels could be shorter
 *   belongs in `floor-both`.
 * - `floor-both`: `minHeight` and `minWidth` at `theme.spacing.x5l` — for
 *   short labels, glyphs and numbers that could otherwise be narrower.
 * - `content`: a full-width padded row or card whose content alone is taller
 *   than the floor (two text lines inside padding, or a whole `Card`).
 * - `primitive`: `AppButton`, which owns its own `MIN_TOUCH_TARGET` floor.
 */
type Rule = 'floor' | 'floor-both' | 'content' | 'primitive';

const REGISTRY: Record<string, readonly Rule[]> = {
  'src/features/nutrition/presentation/DietaryPreferences.tsx': ['floor-both', 'floor'],
  'src/features/nutrition/presentation/food-log/FoodLogAddForm.tsx': ['floor', 'content'],
  'src/features/nutrition/presentation/food-log/ServingStepper.tsx': ['floor-both'],
  'src/features/nutrition/presentation/FoodLogScreen.tsx': ['floor-both'],
  'src/features/nutrition/presentation/NutritionPlanScreen.tsx': ['floor-both'],
  'src/features/progress/presentation/ProgressSummaryCard.tsx': ['content'],
  'src/features/wellness/presentation/wellness-token-group.tsx': ['floor'],
  'src/features/workout/presentation/RoutineBuilder.tsx': ['content', 'content'],
  'src/features/workout/presentation/WorkoutLogScreen.tsx': ['floor', 'content'],
  'src/shared/localization/language-selector.tsx': ['floor'],
  'src/shared/presentation/app-button.tsx': ['primitive'],
  'src/shared/presentation/form/FormSelect.tsx': ['floor-both'],
};

const FLOOR_HEIGHT = /minHeight:\s*theme\.spacing\.x5l\b/;
const FLOOR_WIDTH = /minWidth:\s*theme\.spacing\.x5l\b/;

const discovered = sourceFiles(SRC)
  .map((path) => {
    const text = require('node:fs').readFileSync(path, 'utf8');
    return { path: repoRelative(path), text, sites: pressables(text) };
  })
  .filter(({ sites }) => sites.length > 0);

it('has production Pressables to scan', () => {
  expect(discovered.length).toBeGreaterThanOrEqual(10);
});

it('classifies every production Pressable, and only those', () => {
  const found = Object.fromEntries(discovered.map(({ path, sites }) => [path, sites.length]));
  const expected = Object.fromEntries(
    Object.entries(REGISTRY).map(([path, rules]) => [path, rules.length]),
  );
  // A new or removed <Pressable> changes this map: classify it in REGISTRY.
  expect(found).toEqual(expected);
});

it('counts exactly 16 production Pressables', () => {
  expect(discovered.reduce((total, { sites }) => total + sites.length, 0)).toBe(16);
});

describe.each(
  discovered.flatMap(({ path, text, sites }) =>
    sites.map((site, index) => ({
      label: `${path} #${index + 1}`,
      rule: REGISTRY[path]?.[index],
      site,
      text,
    })),
  ),
)('$label', ({ rule, site, text }) => {
  it('meets the 44×44 touch-target floor', () => {
    expect(rule).toBeDefined();

    switch (rule) {
      case 'floor':
        expect(site.tag).toMatch(FLOOR_HEIGHT);
        break;
      case 'floor-both':
        expect(site.tag).toMatch(FLOOR_HEIGHT);
        expect(site.tag).toMatch(FLOOR_WIDTH);
        break;
      case 'content': {
        // A whole Card, or padding around at least two lines of text.
        const isCard = /<Card\b/.test(site.element);
        const textLines = (site.element.match(/<(AppText|CustomExerciseNote)\b/g) ?? []).length;
        const padded = /padding:\s*theme\.spacing\.(sm|md)\b/.test(site.tag);
        expect(isCard || (padded && textLines >= 2)).toBe(true);
        break;
      }
      case 'primitive': {
        const floor = Number(/const MIN_TOUCH_TARGET = (\d+);/.exec(text)?.[1]);
        expect(floor).toBeGreaterThanOrEqual(44);
        expect(site.tag).toMatch(/minHeight:\s*MIN_TOUCH_TARGET\b/);
        expect(site.tag).toMatch(/minWidth:\s*MIN_TOUCH_TARGET\b/);
        break;
      }
      default:
        throw new Error('unclassified Pressable');
    }
  });
});
