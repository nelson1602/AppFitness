/**
 * Structural guard: the root layout is the only composition root for the
 * purchase runtime, and it initializes it exactly once at module scope
 * (ADR-P034 S-2). Rendering `_layout.tsx` would pull in the whole navigation
 * tree, so the invariant is checked from source — the same idiom as
 * `shared/presentation/route-targets.source.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const fs = require('node:fs');

const SRC = `${__dirname}/../..`;
const CALL = /\binitializeSubscriptionPurchases\s*\(/g;
const CALLS_IT = /\binitializeSubscriptionPurchases\s*\(/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (fs.statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('subscription composition root', () => {
  it('initializes the purchase runtime exactly once, at module scope, in the root layout', () => {
    const layout = fs.readFileSync(`${SRC}/app/_layout.tsx`, 'utf8');

    expect(layout.match(CALL)).toHaveLength(1);
    expect(layout).toMatch(/^initializeSubscriptionPurchases\(\);$/m);
  });

  it('is not initialized from any other production module', () => {
    const callers = sourceFiles(SRC)
      .filter((path) => !path.includes('/features/subscriptions/'))
      .filter((path) => !path.endsWith('/app/_layout.tsx'))
      .filter((path) => CALLS_IT.test(fs.readFileSync(path, 'utf8')));

    expect(callers).toEqual([]);
  });
});
