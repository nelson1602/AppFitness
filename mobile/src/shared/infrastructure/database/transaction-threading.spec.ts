/**
 * **Source guard for BUG-015.**
 *
 * TypeScript cannot enforce this one. `run` / `queryFirst` / `queryAll` take
 * the executor as an *optional* trailing argument, because the great majority
 * of callers are not in a transaction and must keep using the root connection.
 * That same optionality means a statement inside a transaction callback which
 * simply forgets to pass `tx` still compiles — and silently executes on the
 * main connection, outside the transaction it appears to be part of.
 *
 * So the rule is enforced here, on the source: inside any
 * `inTransaction(async (tx) => { … })` body, every SQL helper call must carry
 * the executor, and no helper may reach for the database itself.
 *
 * The applier contract is the opposite case and needs no scan: it takes a
 * single object with a **required** `tx`, so the compiler rejects the legacy
 * positional shape outright.
 */

// Node built-ins used only by this Node/Jest test; the React Native tsconfig
// ships no Node types, so the sliver used here is declared locally.
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC_DIR = `${__dirname}/../../..`;

function filesUnder(dir: string): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((name: string) => {
    const path = `${dir}/${name}`;
    return fs.statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function productionFiles(): string[] {
  return filesUnder(SRC_DIR).filter(
    (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.spec.'),
  );
}

const read = (file: string): string => require('node:fs').readFileSync(file, 'utf8');

const BACKSLASH = String.fromCharCode(92);

/** Advances past a string literal, so an apostrophe in SQL cannot derail us. */
function skipLiteral(text: string, index: number): number {
  const quote = text[index];
  let i = index + 1;
  while (i < text.length && text[i] !== quote) {
    if (text[i] === BACKSLASH) i += 1;
    i += 1;
  }
  return i;
}

/** Advances past a comment, so prose containing braces or quotes is inert. */
function skipNonCode(text: string, index: number): number {
  if (text[index] === '/' && text[index + 1] === '/') {
    const nl = text.indexOf('\n', index);
    return nl === -1 ? text.length : nl;
  }
  if (text[index] === '/' && text[index + 1] === '*') {
    const end = text.indexOf('*/', index + 2);
    return end === -1 ? text.length : end + 1;
  }
  const ch = text[index];
  if (ch === '`' || ch === "'" || ch === '"') return skipLiteral(text, index);
  return index;
}

/** The index of the `}` closing the block that opens at `open`. */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced braces');
}

interface TransactionScope {
  file: string;
  /** The callback's parameter list, e.g. `(tx)` or `()`. */
  header: string;
  body: string;
}

function transactionScopes(): TransactionScope[] {
  const scopes: TransactionScope[] = [];
  for (const file of productionFiles()) {
    const source = read(file);
    const re = /inTransaction\(\s*async\s*(\([^)]*\))\s*=>\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const open = source.indexOf('{', m.index + m[0].length - 1);
      const close = matchBrace(source, open);
      scopes.push({ file, header: m[1], body: source.slice(open + 1, close) });
      re.lastIndex = close;
    }
  }
  return scopes;
}

/**
 * SQL helper calls in `body`, with the argument text of each.
 *
 * The optional `<T>` matters: `queryFirst<BodyWeightRow>(…)` is by far the
 * common form, and a pattern that only matched `queryFirst(` would skip almost
 * every read — leaving the escapes this suite exists to catch invisible.
 */
function sqlCalls(body: string): { name: string; args: string }[] {
  const calls: { name: string; args: string }[] = [];
  const re = /\b(run|queryFirst|queryAll)\s*(?:<[^<>()]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index + m[0].length - 1; i < body.length; i += 1) {
      const skipped = skipNonCode(body, i);
      if (skipped !== i) {
        i = skipped;
        continue;
      }
      if (body[i] === '(') depth += 1;
      else if (body[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    calls.push({ name: m[1], args: body.slice(m.index + m[0].length, end) });
    re.lastIndex = end;
  }
  return calls;
}

describe('every transaction callback threads its executor', () => {
  const scopes = transactionScopes();

  it('finds the transaction scopes it is meant to police', () => {
    // A regression that deleted or renamed `inTransaction` must not silently
    // turn this suite into a no-op.
    expect(scopes.length).toBeGreaterThan(20);
  });

  it('declares the executor parameter on every callback', () => {
    const anonymous = scopes
      .filter((scope) => !/\(\s*tx\s*[,)]/.test(scope.header))
      .map((scope) => `${scope.file} ${scope.header}`);

    expect(anonymous).toEqual([]);
  });

  it('passes the executor to every SQL helper inside a transaction', () => {
    const offenders: string[] = [];
    for (const scope of scopes) {
      for (const call of sqlCalls(scope.body)) {
        if (/(^|[\s,])tx\s*,?\s*$/.test(call.args)) continue;
        offenders.push(`${scope.file}: ${call.name}(${call.args.trim().slice(0, 60)}…)`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never reaches for the database or the root connection inside a transaction', () => {
    const offenders = scopes
      .filter((scope) => /\b(getDatabase|rootExecutor)\s*\(/.test(scope.body))
      .map((scope) => scope.file);

    expect(offenders).toEqual([]);
  });

  it('never nests a transaction inside another', () => {
    const offenders = scopes
      .filter((scope) => scope.body.includes('inTransaction('))
      .map((scope) => scope.file);

    expect(offenders).toEqual([]);
  });
});

describe('the applier contract is compiler-enforced', () => {
  it('takes one object with a required executor, not positional arguments', () => {
    const source = read(`${SRC_DIR}/shared/infrastructure/sync/appliers.ts`);

    // A positional `(data, deleted, userId, tx?)` signature would let a legacy
    // three-argument applier satisfy it and silently drop the executor.
    expect(source).toContain('applyServerChange(input: ApplyServerChangeInput): Promise<void>');
    expect(source).toMatch(/tx: SqlExecutor;/);
    expect(source).not.toMatch(/applyServerChange\(\s*data:/);
  });

  it('gives every applyServer* repository function a required executor', () => {
    const offenders: string[] = [];
    for (const file of productionFiles()) {
      const source = read(file);
      const re = /export async function (applyServer\w+)\(([\s\S]*?)\): Promise<void> \{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source)) !== null) {
        if (!/\btx: SqlExecutor\b/.test(m[2])) offenders.push(`${file}: ${m[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
