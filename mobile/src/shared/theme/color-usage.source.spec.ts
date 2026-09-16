/**
 * Structural guards for semantic colour *usage* — **ADR-P022 Addendum A**.
 *
 * `contrast.spec.ts` proves the palette is accessible. It cannot prove that a
 * component picks the right pair out of it: pairing `primary` with `onSurface`
 * is a defect the token values can never fix, and the four selected chips that
 * shipped it measured 1.42:1 in the dark theme. Those are properties of the
 * source, not of a single rendered arm, so they are read off the source here —
 * a future edit that reintroduces one fails in this file rather than shipping.
 *
 * The precedent is `features/sync-conflicts/conflict-surface.source.spec.ts`,
 * which scans for a forbidden call rather than trusting that nobody makes it.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `conflict-surface.source.spec.ts`.
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

/**
 * Repo-relative and forward-slashed, with `..` segments resolved, so a failure
 * names a file a reader can open and reads identically on Windows and on CI.
 */
function repoRelative(absolute: string): string {
  const resolved: string[] = [];
  for (const segment of absolute.replace(/\\/g, '/').split('/')) {
    if (segment === '..') resolved.pop();
    else if (segment !== '.') resolved.push(segment);
  }
  const joined = resolved.join('/');
  return joined.slice(joined.indexOf('/src/') + 1);
}

const files = sourceFiles(SRC);
const sources = files.map((path) => ({
  path: repoRelative(path),
  text: require('node:fs').readFileSync(path, 'utf8'),
}));

/**
 * The value expression of one style property: everything after `key:` up to the
 * next `key:` that begins a line. Matching the *property* rather than scanning
 * the whole file is what keeps `backgroundColor` from reading a `borderColor`
 * two lines below it and reporting a fill that does not exist.
 */
function styleValues(text: string, property: string): string[] {
  const pattern = new RegExp(`${property}:((?:(?!\\n\\s*[A-Za-z$_][\\w]*\\s*:)[\\s\\S])*)`, 'g');
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function fillsWith(text: string, role: string): boolean {
  return styleValues(text, 'backgroundColor').some((value) =>
    new RegExp(`theme\\.colors\\.${role}\\b`).test(value),
  );
}

it('has the whole mobile source tree to scan', () => {
  expect(files.length).toBeGreaterThanOrEqual(100);
});

describe('`outline` is a boundary role and is never rendered as text', () => {
  // `outline` measures 4.490:1 on `surface` and 3.963:1 on `surfaceVariant` in
  // the light theme — below the 4.5:1 text threshold on both, and WCAG ratios
  // are not rounded upward. It stays valid as a >=3:1 border.
  // `onSurfaceVariant` is the canonical placeholder-text role.
  it.each([
    ['placeholderTextColor={theme.colors.outline}', 'placeholder text'],
    ['color: theme.colors.outline', 'a text colour'],
  ])('never uses %s (%s)', (forbidden) => {
    for (const { path, text } of sources) {
      expect([path, text.includes(forbidden)]).toEqual([path, false]);
    }
  });

  it('still uses outline as a border role, so the guard above is not vacuous', () => {
    const borderUsers = sources.filter(({ text }) =>
      /border(Color|LeftColor)?:\s*[^;]*theme\.colors\.outline/.test(text),
    );
    expect(borderUsers.length).toBeGreaterThanOrEqual(5);
  });
});

describe('a `primary` fill carries the `onPrimary` foreground', () => {
  /**
   * The one `primary` fill that carries no text. TrendBars paints bar heights,
   * and its latest/other distinction is additionally stated in visible text
   * (UX-3D R-4), so it needs no label foreground. Listing it explicitly is what
   * lets the rule below stay strict for every other file.
   */
  const NON_TEXT_PRIMARY_FILLS = ['src/features/progress/presentation/TrendBars.tsx'];

  const filled = sources.filter(({ text }) => fillsWith(text, 'primary'));

  it('finds the filled surfaces it is meant to police', () => {
    expect(filled.length).toBeGreaterThanOrEqual(6);
  });

  it.each(filled.map(({ path }) => path))('%s pairs its fill with onPrimary', (path) => {
    const { text } = filled.find((f) => f.path === path)!;
    const pairs = /onPrimary/.test(text) || NON_TEXT_PRIMARY_FILLS.includes(path);
    expect([path, pairs]).toEqual([path, true]);
  });

  it('never labels a selection through the default or onSurface tone beside a primary fill', () => {
    // The exact regressed idiom: a chip that switches its fill to `primary`
    // while switching its label between the default tone and `muted`. The
    // default tone resolves to `onSurface`, which is the 1.42:1 dark-theme
    // failure this addendum corrected in four files.
    for (const { path, text } of filled) {
      expect([path, /tone=\{[^}]*\?\s*'default'\s*:/.test(text)]).toEqual([path, false]);
    }
  });
});

describe('a filled variant uses the `on*` foreground of its own role', () => {
  const appButton = sources.find(({ path }) =>
    path.endsWith('shared/presentation/app-button.tsx'),
  )!;

  it('maps the destructive variant to onError, not onPrimary', () => {
    expect(appButton.text).toContain('destructive: theme.colors.onError');
  });

  it('still maps the primary variant to onPrimary', () => {
    expect(appButton.text).toContain('primary: theme.colors.onPrimary');
  });
});

describe('`divider` never bounds an interactive element', () => {
  /**
   * `divider` is exempt from 1.4.11 only while it stays decorative — it
   * measures 1.27:1 light / 1.29:1 dark. `.ai/08_UI_UX.md` names the escape
   * itself: "if a divider ever becomes the sole boundary of an interactive
   * element, it must meet 3:1 or an `outline` must be used instead."
   * `FoodLogAddForm`'s food-result `Pressable` had exactly that boundary.
   */
  const pressableFiles = sources.filter(({ text }) => /<Pressable\b/.test(text));

  it('finds the pressable surfaces it is meant to police', () => {
    expect(pressableFiles.length).toBeGreaterThanOrEqual(6);
  });

  it.each(pressableFiles.map(({ path }) => path))('%s bounds nothing with divider', (path) => {
    const { text } = pressableFiles.find((f) => f.path === path)!;
    const bounded = styleValues(text, 'borderColor').some((value) =>
      /theme\.colors\.divider\b/.test(value),
    );
    expect([path, bounded]).toEqual([path, false]);
  });

  it('still uses divider on the passive Card boundary, so the guard is not vacuous', () => {
    const card = sources.find(({ path }) => path.endsWith('shared/presentation/card.tsx'))!;
    expect(card.text).toContain('theme.colors.divider');
    expect(/<Pressable\b/.test(card.text)).toBe(false);
  });
});

describe('a semantic tone is never clobbered by an undefined colour', () => {
  /**
   * `AppText` composes `[typography, { color: tone }, style]`. A caller style of
   * `{ color: undefined }` therefore *overwrites* the resolved tone when the
   * array is flattened, and the label falls back to React Native's default
   * black — 1.23:1 on the dark `surface`. `AppButton` shipped exactly that for
   * its `secondary` and `text` variants. A conditional colour must omit the
   * whole style object, not pass an undefined member.
   */
  it('never writes `color: undefined` into a style object', () => {
    for (const { path, text } of sources) {
      expect([path, /\bcolor:\s*undefined\b/.test(text.replace(/`[^`]*`/g, ''))]).toEqual([
        path,
        false,
      ]);
    }
  });
});

describe('no raw colour enters a component', () => {
  it('assigns no literal hex to any colour property in a .tsx file', () => {
    for (const { path, text } of sources) {
      if (!path.endsWith('.tsx')) continue;
      const literal = text.match(/\b[a-zA-Z]*[cC]olor\w*\s*[:=]\s*'#[0-9A-Fa-f]{3,8}'/g);
      expect([path, literal]).toEqual([path, null]);
    }
  });

  it('resolves every colour through the theme, so the guard above is not vacuous', () => {
    const themeConsumers = sources.filter(({ text }) => /theme\.colors\./.test(text));
    expect(themeConsumers.length).toBeGreaterThanOrEqual(20);
  });
});
