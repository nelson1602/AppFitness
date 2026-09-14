/**
 * Structural guards for the conflict surface — ADR-P030 **C-6**.
 *
 * Some properties cannot be proven by rendering one arm at a time: that *no*
 * string is hardcoded anywhere, that *no* announcement mechanism was
 * introduced, and that the UI reaches nothing below the C-4 service. Those are
 * read off the source, so a future edit that reintroduces one fails here
 * rather than shipping.
 *
 * The precedent is `wellness-safety.activation.spec.ts`, which scans for the
 * medical registrar rather than trusting that nobody calls it.
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

const FEATURE = __dirname;
const REPO_SRC = `${__dirname}/../..`;

function sourceFiles(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((entry: string) => {
    const path = `${dir}/${entry}`;
    if (fs.statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry) || /\.spec\.tsx?$/.test(entry)) return [];
    return [path];
  });
}

const files = sourceFiles(FEATURE);
const sources = files.map((path) => ({
  path,
  text: require('node:fs').readFileSync(path, 'utf8'),
}));

it('has source to scan', () => {
  expect(files.length).toBeGreaterThanOrEqual(5);
});

describe('no announcement mechanism is introduced (ADR-P024; R-13)', () => {
  it.each(['accessibilityLiveRegion', 'announceForAccessibility', 'aria-live'])(
    'never uses %s',
    (mechanism) => {
      for (const { path, text } of sources) {
        expect([path, text.includes(mechanism)]).toEqual([path, false]);
      }
    },
  );

  it('wraps nothing in an accessible container that would swallow its children (R-12)', () => {
    for (const { path, text } of sources) {
      expect([path, /\baccessible[=\s]/.test(text)]).toEqual([path, false]);
    }
  });
});

describe('every user-visible string comes from the catalogue', () => {
  it('passes only a translated key to accessibilityLabel', () => {
    for (const { path, text } of sources) {
      const labels = [...text.matchAll(/accessibilityLabel=\{([^}]*)\}/g)].map((m) => m[1].trim());
      for (const label of labels) expect([path, label.startsWith('t(')]).toEqual([path, true]);
    }
  });

  it('renders no literal text between JSX tags', () => {
    // `.tsx` only: a generic like `Promise<T>` in a `.ts` module is not markup.
    for (const { path, text } of sources.filter((file) => file.path.endsWith('.tsx'))) {
      // A word of three or more letters sitting directly between tags would be
      // copy the catalogue does not own.
      const literals = [...text.matchAll(/>\s*([A-Za-z]{3,}[^<{}]*)</g)].map((m) => m[1].trim());
      expect([path, literals]).toEqual([path, []]);
    }
  });

  it('declares no colour of its own — only semantic tokens', () => {
    for (const { path, text } of sources) {
      expect([path, /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text)]).toEqual([path, false]);
    }
  });

  it('sizes nothing with a raw number — spacing comes from the theme', () => {
    for (const { path, text } of sources) {
      const raw = [
        ...text.matchAll(/\b(padding|margin|gap|borderRadius|height|width)[A-Za-z]*:\s*\d/g),
      ].map((m) => m[0]);
      expect([path, raw]).toEqual([path, []]);
    }
  });

  it('fixes no text height, so large type can grow (R-11)', () => {
    for (const { path, text } of sources) {
      expect([path, /lineHeight:|numberOfLines=/.test(text)]).toEqual([path, false]);
    }
  });
});

describe('the surface stays above the C-4 service', () => {
  it('imports no database, transport or crypto module', () => {
    const forbidden = [
      'expo-sqlite',
      "from '@/shared/infrastructure/database'",
      'sync-transport',
      'field-cipher',
      'sync-queue',
      'sync-conflicts.ts',
    ];
    for (const { path, text } of sources) {
      for (const module of forbidden) {
        expect([path, module, text.includes(module)]).toEqual([path, module, false]);
      }
    }
  });

  it('parses no payload and duplicates no settlement logic', () => {
    for (const { path, text } of sources) {
      expect([path, /JSON\.parse|__enc|inTransaction|markConflictSettled/.test(text)]).toEqual([
        path,
        false,
      ]);
    }
  });

  it('reaches the local database only through the platform-boundary type guard', () => {
    const store = sources.find((file) => file.path.endsWith('sync-conflicts.store.ts'));
    expect(store?.text).toContain('isDatabaseUnsupportedOnWebError');
    expect(store?.text).toContain("from '@/shared/infrastructure/sync'");
  });
});

describe('the existing report-only surfaces are untouched', () => {
  it('routes to the review screen from the dashboard button and nowhere else', () => {
    const navigating = sourceFiles(REPO_SRC)
      .map((path) => ({ path, text: require('node:fs').readFileSync(path, 'utf8') }))
      .filter((file) => file.text.includes("'/sync-conflicts'"))
      .map((file) => file.path.replace(REPO_SRC, '').replace(/\\/g, '/'));

    expect(navigating).toEqual(['/features/dashboard/presentation/DashboardScreen.tsx']);
  });

  it('leaves the sync banner with no press handler at all', () => {
    const banner = require('node:fs').readFileSync(
      `${REPO_SRC}/features/dashboard/presentation/components/sync-status-banner.tsx`,
      'utf8',
    );

    expect(banner).not.toContain('onPress');
    expect(banner).not.toContain('router');
    expect(banner).not.toContain('Pressable');
  });
});
