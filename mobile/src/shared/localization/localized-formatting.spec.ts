import type * as TS from 'typescript';

/**
 * Locale-correct formatting on public-v1 surfaces — Stage 1 item 2, the
 * bilingual quality review (`.ai/21_BILINGUAL_SURFACE_AUDIT.md` §Handoff).
 *
 * `surface-coverage.spec.ts` proves that the *words* come from the catalogues.
 * This spec proves the complementary half: that the **numbers between those
 * words** come from the shared formatter. The two are independent failures — a
 * screen can resolve every string through `t()` and still print `82.5 kg` and
 * `2500 kcal` to a Spanish reader, which is what three surfaces did before this
 * slice.
 *
 * The check is by **type, not by name**: it asks the TypeScript compiler which
 * rendered expressions are numeric, exactly as the audit's Pass 5 did, so a
 * newly added `{someCount}` is caught without anyone remembering to list it.
 * What it deliberately does not flag:
 *
 *  - identifiers and keys — `testID`, `key` and any other non-announced prop;
 *  - ISO storage values — recorded once, by name, in `ACCEPTED_BYPASS`;
 *  - counters used only for branching — they are never rendered, so the
 *    compiler never sees them in a rendered position;
 *  - dormant and unreachable code — `features/medical/**` (ADR-P017) and
 *    `TrainingPlanCard` (F-12), both excluded here for the same reasons
 *    `surface-coverage.spec.ts` excludes them, and both pinned there.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `surface-coverage.spec.ts` and `conflict-catalogue.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};
declare function require(id: 'typescript'): typeof TS;

const fs = require('node:fs');
const ts = require('typescript');

/** `mobile/src`, forward-slashed so paths read the same on every platform. */
const SRC = __dirname.replace(/\\/g, '/').replace(/\/shared\/localization$/, '');
const PROJECT = SRC.replace(/\/src$/, '');
const relative = (file: string): string => `src${file.slice(SRC.length)}`;

/**
 * Surfaces a user actually reads: the route entry points and every feature
 * presentation layer.
 *
 * `shared/presentation/**` is **not** a surface. Its primitives render
 * caller-supplied `children` typed as `ReactNode` — they own no copy and no
 * value of their own, which is exactly what the audit recorded for them. The
 * caller is the one that must format, and the caller is in this list.
 */
function isSurface(file: string): boolean {
  if (!/\.tsx?$/.test(file) || /\.spec\.tsx?$/.test(file)) return false;
  if (/\/(tests|testing)\//.test(file)) return false;
  // Dormant under ADR-P017; keeps its hardcoded English and never ships.
  if (file.includes('/features/medical/')) return false;
  // Unreachable dead UI (F-12). `surface-coverage.spec.ts` fails if any
  // production module imports it, which is what keeps this exclusion honest.
  if (file.endsWith('/TrainingPlanCard.tsx')) return false;
  return file.startsWith(`${SRC}/app/`) || /\/features\/[^/]+\/presentation\//.test(file);
}

function allFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (fs.statSync(full).isDirectory()) allFiles(full, out);
    else out.push(full);
  }
  return out;
}

const PRODUCTION = allFiles(SRC).filter(
  (file) => /\.tsx?$/.test(file) && !/\.spec\.tsx?$/.test(file),
);
const SURFACES = PRODUCTION.filter(isSurface);

/** Props whose string value is rendered on screen or announced by AT. */
const TEXT_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'accessibilityValue',
  'placeholder',
  'title',
  'label',
]);

/**
 * Rendered-looking numeric expressions that are **not** display, recorded
 * individually so the assertion below can be a set equality: a new bypass and
 * a stale entry both fail.
 */
const ACCEPTED_BYPASS: Readonly<Record<string, string>> = {
  'src/features/progress/presentation/ProgressScreen.tsx#todayLocalDate: y':
    'builds the ISO YYYY-MM-DD storage key that seeds the entry forms — data, not display',
};

interface Finding {
  id: string;
}

function program(): TS.Program {
  const configPath = `${PROJECT}/tsconfig.json`;
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  } as TS.ParseConfigFileHost);
  if (!parsed) throw new Error(`could not read ${configPath}`);
  // Only the surfaces are roots; the compiler pulls in whatever they import, so
  // the types are the real ones while the program stays small enough to build
  // inside a test.
  return ts.createProgram({ rootNames: SURFACES, options: parsed.options });
}

/** A number, or a union one of whose members is a number. */
function isNumericLike(type: TS.Type): boolean {
  if (type.getFlags() & ts.TypeFlags.NumberLike) return true;
  return type.isUnion() && type.types.some((member) => member.getFlags() & ts.TypeFlags.NumberLike);
}

/** The nearest enclosing JSX attribute, if the expression sits inside one. */
function enclosingAttribute(node: TS.Node): TS.JsxAttribute | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxAttribute(current)) return current;
    if (ts.isSourceFile(current)) return undefined;
  }
  return undefined;
}

/** The nearest named function around the expression, for a stable finding id. */
function enclosingFunctionName(node: TS.Node): string {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    if (ts.isSourceFile(current)) break;
  }
  return '<module>';
}

function numericRendersWithoutFormatter(): Finding[] {
  // One program: a checker only understands nodes from the program it came from.
  const compiled = program();
  const checker = compiled.getTypeChecker();
  const wanted = new Set(SURFACES);
  const findings: Finding[] = [];

  for (const source of compiled.getSourceFiles()) {
    const file = source.fileName.replace(/\\/g, '/');
    if (source.isDeclarationFile || !wanted.has(file)) continue;

    const visit = (node: TS.Node): void => {
      // A number reaches the user in exactly two shapes: as a JSX child, or
      // interpolated into a template literal that becomes rendered text.
      const expression =
        ts.isJsxExpression(node) &&
        node.expression &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
          ? node.expression
          : ts.isTemplateSpan(node)
            ? node.expression
            : undefined;

      if (expression && isNumericLike(checker.getTypeAtLocation(expression))) {
        // Inside a prop that is neither rendered nor announced — an id, a key,
        // a style, a state flag. Not display, so not this spec's business.
        const attribute = enclosingAttribute(expression);
        const announced =
          !attribute || (ts.isIdentifier(attribute.name) && TEXT_PROPS.has(attribute.name.text));
        if (announced) {
          const where = `${relative(file)}#${enclosingFunctionName(expression)}`;
          findings.push({ id: `${where}: ${expression.getText().replace(/\s+/g, ' ')}` });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return findings;
}

describe('public-v1 surfaces render numbers through the shared formatter', () => {
  it('reads a non-trivial surface list', () => {
    expect(SURFACES.length).toBeGreaterThanOrEqual(30);
    expect(SURFACES.map(relative)).toContain(
      'src/features/nutrition/presentation/FoodLogScreen.tsx',
    );
    expect(SURFACES.map(relative)).toContain(
      'src/features/workout/presentation/GeneratedWorkoutPlan.tsx',
    );
  });

  it('routes every user-facing numeric value through formatNumber', () => {
    const found = numericRendersWithoutFormatter()
      .map((finding) => finding.id)
      .sort();
    // Set equality, not containment: an unformatted value that appears and an
    // exemption that stops being needed are both regressions of this document.
    expect(found).toEqual(Object.keys(ACCEPTED_BYPASS).sort());
  });
});

describe('the shared formatter is the only locale-aware formatting path', () => {
  it('constructs Intl nowhere but format.ts', () => {
    // `toLocaleLowerCase` is deliberately not matched: it is case folding, not
    // presentation, and `food-display.service.ts` uses it for search.
    const pattern = /new Intl\.|\.toLocale(?:Date|Time)?String\s*\(/;
    const offenders = PRODUCTION.filter((file) => pattern.test(fs.readFileSync(file, 'utf8'))).map(
      relative,
    );
    expect(offenders).toEqual(['src/shared/localization/format.ts']);
  });

  it('keeps every public-v1 display date on formatDate', () => {
    const callers = PRODUCTION.filter((file) =>
      /\bformatDate\(/.test(fs.readFileSync(file, 'utf8')),
    )
      .map(relative)
      .sort();
    // The surfaces the audit traced. Losing one means a date went raw or ISO.
    expect(callers).toEqual(
      expect.arrayContaining([
        'src/features/progress/presentation/ProgressScreen.tsx',
        'src/features/progress/presentation/ProgressSummaryCard.tsx',
        'src/features/progress/presentation/WeeklySnapshotSummary.tsx',
        'src/features/sync-conflicts/presentation/conflict-value.ts',
      ]),
    );
  });
});
