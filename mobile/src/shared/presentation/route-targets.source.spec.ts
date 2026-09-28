/**
 * Structural guard for navigation targets — **BUG-006**.
 *
 * The dormant `EvaluationHistory` once pushed to `/evaluation-edit`, a route with
 * no file behind it. Expo Router's typed routes catch that only when
 * `.expo/types/router.d.ts` has been generated, which CI never does, so this
 * file checks the invariant from source instead: every string-literal target
 * passed to `router.push` / `router.replace` / `router.navigate` in `mobile/src`
 * must resolve to a route file in `mobile/src/app`.
 *
 * Scope is deliberately literal-only. A target built at runtime (a variable, a
 * template literal with `${}`) cannot be resolved from source and is skipped
 * rather than guessed at. Resolution follows Expo Router's file conventions:
 * `index` is the directory's root, `(group)` segments add nothing to the URL,
 * `[param]` / `[...rest]` match dynamic segments, and `_layout` / `+html` /
 * `+not-found` are not navigable targets.
 *
 * The precedent is `shared/presentation/touch-target.source.spec.ts`.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `touch-target.source.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC = `${__dirname}/../..`;
const APP = `${SRC}/app`;

function filesUnder(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((entry: string) => {
    const path = `${dir}/${entry}`;
    if (fs.statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
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

/** A route file path relative to `app/`, e.g. `(auth)/sign-in.tsx`, as URL segments. */
function routePattern(relativeFile: string): string[] | null {
  const segments = relativeFile.replace(/\.tsx?$/, '').split('/');
  const name = segments[segments.length - 1];
  if (name.startsWith('_') || name.startsWith('+') || /\.spec$/.test(name)) return null;
  return segments
    .filter((s) => !/^\(.+\)$/.test(s))
    .filter((s, i, all) => {
      return !(s === 'index' && i === all.length - 1);
    });
}

/** Whether a literal target such as `/dashboard?tab=1` resolves to one of `patterns`. */
function resolves(target: string, patterns: string[][]): boolean {
  const path = target.split(/[?#]/)[0];
  const segments = path.split('/').filter((s) => s.length > 0);
  return patterns.some((pattern) => {
    const rest = pattern.findIndex((p) => /^\[\.\.\..+\]$/.test(p));
    if (rest >= 0) {
      if (segments.length < rest + 1) return false;
      return pattern.slice(0, rest).every((p, i) => p === segments[i] || /^\[.+\]$/.test(p));
    }
    if (pattern.length !== segments.length) return false;
    return pattern.every((p, i) => p === segments[i] || /^\[.+\]$/.test(p));
  });
}

interface NavigationCall {
  file: string;
  method: string;
  argument: string;
  targets: string[];
}

/** Every `router.push|replace|navigate(…)` call and the static `/…` literals in its argument. */
function navigationCalls(file: string, source: string): NavigationCall[] {
  const calls: NavigationCall[] = [];
  const opener = /\brouter\.(push|replace|navigate)\(/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source))) {
    let depth = 1;
    let quote: string | null = null;
    let i = match.index + match[0].length;
    const start = i;
    for (; i < source.length && depth > 0; i++) {
      const c = source[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    const argument = source.slice(start, i - 1);
    const targets = [...argument.matchAll(/(['"`])(\/[^'"`]*)\1/g)]
      .map((m) => m[2])
      .filter((t) => !t.includes('${'));
    calls.push({ file, method: match[1], argument: argument.trim(), targets });
  }
  return calls;
}

const APP_PATTERNS = filesUnder(APP)
  .map((f) => routePattern(repoRelative(f).replace(/^src\/app\//, '')))
  .filter((p): p is string[] => p !== null);

const CALLS = filesUnder(SRC)
  .filter((f) => !/\.spec\.tsx?$/.test(f))
  .flatMap((f) => navigationCalls(repoRelative(f), require('node:fs').readFileSync(f, 'utf8')));

describe('navigation targets resolve to real routes (BUG-006)', () => {
  it('finds the real navigation calls, so the guard is not vacuous', () => {
    const literalTargets = CALLS.flatMap((c) => c.targets);
    expect(literalTargets.length).toBeGreaterThanOrEqual(25);
    expect(new Set(CALLS.map((c) => c.file)).size).toBeGreaterThanOrEqual(10);
    expect(APP_PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it('resolves every string-literal router target to a file in src/app', () => {
    const unresolved = CALLS.flatMap((call) =>
      call.targets
        .filter((target) => !resolves(target, APP_PATTERNS))
        .map((target) => `${call.file}: router.${call.method}('${target}')`),
    );
    expect(unresolved).toEqual([]);
  });

  it('no longer navigates to the non-existent /evaluation-edit', () => {
    expect(resolves('/evaluation-edit', APP_PATTERNS)).toBe(false);
    expect(CALLS.flatMap((c) => c.targets)).not.toContain('/evaluation-edit');
  });

  it('reads every literal in a conditional target', () => {
    const verify = CALLS.find(
      (c) => c.file.endsWith('app/verify-email.tsx') && c.argument.includes('?'),
    );
    expect(verify?.targets).toEqual(['/dashboard', '/sign-in']);
  });
});

describe('route-target resolver', () => {
  const patterns = [
    'index.tsx',
    'dashboard.tsx',
    '(auth)/sign-in.tsx',
    'settings/index.tsx',
    'items/[id].tsx',
    'docs/[...path].tsx',
    '_layout.tsx',
    '+not-found.tsx',
  ]
    .map(routePattern)
    .filter((p): p is string[] => p !== null);

  it.each([
    ['/', true],
    ['/dashboard', true],
    ['/dashboard?tab=1', true],
    ['/dashboard#top', true],
    ['/sign-in', true],
    ['/settings', true],
    ['/items/42', true],
    ['/docs/a/b', true],
    ['/evaluation-edit', false],
    ['/items', false],
    ['/_layout', false],
    ['/+not-found', false],
    ['/(auth)/sign-in', false],
  ])('resolves %s → %s', (target, expected) => {
    expect(resolves(target, patterns)).toBe(expected);
  });

  it('extracts literals across lines, ternaries and nested calls, skipping runtime targets', () => {
    const source = [
      "router.push('/a');",
      'router.replace(ok ? \'/b\' : "/c");',
      'router.push(',
      "  '/d',",
      ');',
      "router.push(fn('x)'), '/e');",
      'router.push(`/f/${id}`);',
      'router.push(route);',
    ].join('\n');
    expect(navigationCalls('x.tsx', source).map((c) => c.targets)).toEqual([
      ['/a'],
      ['/b', '/c'],
      ['/d'],
      ['/e'],
      [],
      [],
    ]);
  });
});
