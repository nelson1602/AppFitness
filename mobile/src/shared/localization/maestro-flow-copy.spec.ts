/**
 * Device-journey copy contract — the guard for the defect class that kept
 * gate **E1** stale (`docs/RELEASE_READINESS.md`, `OBS-T2-4`).
 *
 * Every Maestro journey in `mobile/.maestro` asserts on copy the app renders.
 * Nothing kept those assertions honest: a journey could name a string the
 * product had renamed, or one that survives only inside a component nothing
 * imports any more, and the repository stayed green — the failure surfaced
 * only on a device, in a suite that ran rarely enough for the drift to
 * accumulate. Four journeys were found asserting copy in those two shapes:
 * `registration`, `onboarding-loop` and `offline-entry` named copy ADR-P027
 * replaced, and `workout-training-plan` waited on a heading that survives only
 * in an unreachable module.
 *
 * So this pins what the cheap check can actually prove:
 *
 *  1. every literal a journey asserts on exists somewhere in shipped source;
 *  2. it exists somewhere the assembled app can **reach**, walked transitively
 *     from the Expo Router entry points.
 *
 * What it deliberately does not claim: that the copy renders in the *state*
 * the journey is in, or that it is on screen rather than below the fold.
 * Neither is decidable from source, and both have caused real failures here.
 * This narrows the gap; only the cloud suite closes it.
 *
 * It reads source rather than importing it, the same idiom and for the same
 * reason as `surface-coverage.spec.ts`: the assertion has to be about what the
 * repository actually ships.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `surface-coverage.spec.ts`.
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
/** `mobile/.maestro`, a sibling of `mobile/src`. */
const FLOW_DIR = `${SRC.replace(/\/src$/, '')}/.maestro`;

/** Every shipped source file, excluding tests. */
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
      out.push(full);
    }
  };
  walk(SRC);
  return out;
}

const FILES = productionFiles();
const SOURCE = new Map(FILES.map((file) => [file, fs.readFileSync(file, 'utf8')]));
const relative = (file: string): string => `src${file.slice(SRC.length)}`;

/**
 * Resolves one import specifier to a file in `SOURCE`, or `null` when it
 * points outside `src` (a package, an asset). `@/…` is the `src` alias
 * declared in `tsconfig.json`; everything else of interest is relative.
 */
function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = `${SRC}/${specifier.slice(2)}`;
  } else if (specifier.startsWith('.')) {
    const dir = fromFile.slice(0, fromFile.lastIndexOf('/'));
    const parts = `${dir}/${specifier}`.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    // Keep the root exactly as the walked paths spell it — a POSIX path starts
    // with `/`, a Windows one with a drive letter, and prepending `/` to the
    // latter silently resolves nothing.
    base = `${dir.startsWith('/') ? '/' : ''}${stack.join('/')}`;
  } else {
    return null;
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (SOURCE.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Modules the assembled app can actually reach, walked transitively from the
 * Expo Router entry points under `src/app`.
 *
 * Reachability has to be measured from the entry points, not from "something
 * imports it": a dormant feature's own files still import each other, so a
 * local check would call the whole of it reachable — which is exactly the
 * mistake that hides copy like `TrainingPlanCard`'s.
 */
const REACHABLE: ReadonlySet<string> = (() => {
  const seen = new Set<string>();
  const queue = FILES.filter((file) => file.startsWith(`${SRC}/app/`));
  queue.forEach((file) => seen.add(file));
  while (queue.length > 0) {
    const file = queue.pop() as string;
    const text = SOURCE.get(file) ?? '';
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, match[1]);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
})();

const isReachable = (file: string): boolean => REACHABLE.has(file);

/**
 * `medical-management.yml` is retained but **not run**: ADR-P017 Decision 4
 * made the medical domain dormant, so the workflow dropped the flow and its
 * screens have no importer. Reactivation is gated by ADR-P017 Decision 9,
 * which is when this exemption should be revisited — not before.
 */
const DORMANT_FLOWS = new Set(['medical-management.yml']);

/**
 * Literals a journey types or that the app composes at runtime. These are not
 * shipped copy, so source can say nothing about them.
 *
 *  - `E2E …` values are typed **by** the journey into a form.
 *  - The rest are interpolated at render time from data the journey created,
 *    so only their template exists in source.
 */
const RUNTIME_COMPOSED = [
  /^E2E /,
  /^\d+ reading/,
  /^Day \d+$/,
  // Dietary-preference chip: an exclusion label joined to its mode.
  / · /,
];

/** Selector keys whose value is copy the app must render. */
const COPY_KEYS = ['assertVisible', 'assertNotVisible', 'tapOn', 'visible', 'element', 'text'];

/** Characters that make a Maestro selector a regex rather than a literal. */
const REGEX_CHARS = ['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'];

interface Assertion {
  readonly flow: string;
  readonly line: number;
  readonly key: string;
  readonly literal: string;
}

function assertions(): Assertion[] {
  const out: Assertion[] = [];
  for (const flow of fs.readdirSync(FLOW_DIR).filter((f) => f.endsWith('.yml'))) {
    const text = fs.readFileSync(`${FLOW_DIR}/${flow}`, 'utf8');
    text.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return;
      const key = COPY_KEYS.find(
        (k) => trimmed.startsWith(`- ${k}:`) || trimmed.startsWith(`${k}:`),
      );
      if (!key) return;
      const value = trimmed.slice(trimmed.indexOf(':') + 1).trim();
      const quote = value[0];
      if (quote !== "'" && quote !== '"') return;
      if (value[value.length - 1] !== quote || value.length < 3) return;
      const literal = value.slice(1, -1);
      if (!literal || literal.startsWith('id:')) return;
      if (REGEX_CHARS.some((c) => literal.includes(c))) return;
      if (RUNTIME_COMPOSED.some((pattern) => pattern.test(literal))) return;
      out.push({ flow, line: index + 1, key, literal });
    });
  }
  return out;
}

const ASSERTIONS = assertions();
const holders = (literal: string): string[] =>
  [...SOURCE].filter(([, text]) => text.includes(literal)).map(([file]) => file);

describe('Maestro journey copy', () => {
  it('scans the journeys it claims to cover', () => {
    // A parser that silently matched nothing would make every assertion below
    // vacuous, which is the failure mode this whole spec exists to prevent.
    expect(ASSERTIONS.length).toBeGreaterThan(100);
  });

  it('asserts only on copy that exists in shipped source', () => {
    const missing = ASSERTIONS.filter(
      (a) => !DORMANT_FLOWS.has(a.flow) && holders(a.literal).length === 0,
    ).map((a) => `${a.flow}:${a.line} ${a.key} ${JSON.stringify(a.literal)}`);
    expect(missing).toEqual([]);
  });

  it('asserts only on copy that lives in a reachable module', () => {
    // The shape that made `workout-training-plan.yml` unprovable: it waited on
    // "Your training guidance", which survives only in `TrainingPlanCard` —
    // an unreachable leftover the shipped `GeneratedWorkoutPlan` replaced.
    const unreachable = ASSERTIONS.filter((a) => {
      if (DORMANT_FLOWS.has(a.flow)) return false;
      const found = holders(a.literal);
      return found.length > 0 && found.every((file) => !isReachable(file));
    }).map(
      (a) =>
        `${a.flow}:${a.line} ${a.key} ${JSON.stringify(a.literal)} -> only in ` +
        holders(a.literal).map(relative).join(', '),
    );
    expect(unreachable).toEqual([]);
  });

  it('keeps the dormant-flow exemption honest', () => {
    // The exemption is only defensible while the flow really is unrunnable.
    // If `medical-management.yml`'s screens become reachable again, ADR-P017
    // Decision 9 has been exercised and this exemption must be re-decided.
    const medicalScreens = FILES.filter((file) => file.includes('/features/medical/presentation/'));
    expect(medicalScreens.length).toBeGreaterThan(0);
    expect(medicalScreens.filter(isReachable).map(relative)).toEqual([]);
  });
});
