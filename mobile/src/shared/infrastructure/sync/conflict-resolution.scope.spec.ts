import { MIGRATIONS } from '../database/migrations';
import { SUPPORTED_PRESENTER_ENTITY_TYPES } from './conflict-presenter';
import * as syncApi from './index';

/**
 * **Scope invariants for ADR-P030 slice C-4.**
 *
 * C-4 is the local resolution service and the outbox behaviour behind it —
 * and nothing else. C-5 owns the copy, C-6 owns the `/sync-conflicts` route
 * and the dashboard button, C-7 owns the end-to-end journeys. These scans fail
 * if this slice grows into any of them, or reaches for surfaces it must not
 * touch.
 *
 * They also assert the rule that makes the service worth having: presentation
 * never reaches SQLite, and every conflict surface goes through the service.
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

/** Comments stripped, so a doc comment naming a symbol to rule it out cannot fail. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const presentationFiles = (): string[] =>
  productionFiles().filter((file) => file.includes('/presentation/') || file.includes('/src/app/'));

describe('C-4 keeps SQLite out of presentation', () => {
  it('no presentation file imports the database module or writes SQL', () => {
    const offenders = presentationFiles().filter((file) => {
      const source = code(read(file));
      return (
        /from\s+['"][^'"]*infrastructure\/database['"]/.test(source) ||
        /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\s+[a-z_]/.test(source)
      );
    });

    expect(offenders).toEqual([]);
  });

  it('no presentation file touches the conflict tables or the outbox columns', () => {
    const forbidden = [
      'sync_conflicts',
      'sync_queue',
      'chosen_resolution',
      'settlement_status',
      'blocked_resolution',
      'last_failure_code',
    ];
    const offenders = presentationFiles().filter((file) => {
      const source = code(read(file));
      return forbidden.some((token) => source.includes(token));
    });

    expect(offenders).toEqual([]);
  });

  it('the outbox transitions are reached only through the sync module', () => {
    // `sync-conflicts.ts` is the store; the service and the barrel are its only
    // callers, so a feature cannot bypass the guarded transitions.
    const offenders = productionFiles().filter(
      (file) =>
        !file.includes('/shared/infrastructure/sync/') &&
        /from\s+['"][^'"]*sync\/sync-conflicts['"]/.test(code(read(file))),
    );

    expect(offenders).toEqual([]);
  });
});

describe('C-4 adds no UI, copy, server or schema surface', () => {
  it('adds no migration beyond the seven already shipped', () => {
    // The outbox columns were pre-provisioned by 006; C-4 only activates them.
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not touch migration 006', () => {
    const source = read(
      `${SRC_DIR}/shared/infrastructure/database/migrations/006-sync-user-scoping.ts`,
    );
    // The dormancy note is 006's own record that C-4 owns the behaviour, not
    // the schema. If C-4 had edited the migration, this sentence would have had
    // to change with it.
    expect(source).toContain('DORMANT SCHEMA ONLY');
    expect(source).toContain('Slice C-4 owns');
  });

  it('ships no conflict route, screen or copy key', () => {
    const appFiles = productionFiles().filter((file) => file.includes('/src/app/'));
    expect(appFiles.filter((file) => file.includes('sync-conflict'))).toEqual([]);

    const copy = [
      `${SRC_DIR}/shared/localization/resources/en.ts`,
      `${SRC_DIR}/shared/localization/resources/es.ts`,
    ];
    for (const file of copy) {
      const source = read(file);
      // C-5 owns the copy families; nothing may pre-empt them here.
      expect(source).not.toContain('restore-not-possible');
      expect(source).not.toContain('syncConflicts');
    }
  });

  it('never sends server-authored prose to a caller', () => {
    const service = code(read(`${__dirname}/conflict-resolution.ts`));
    // The only strings persisted or surfaced are client-authored codes.
    expect(service).toContain(`'network_error'`);
    expect(service).toMatch(/http_\$\{/);
    // Nothing reads a message/detail/reason field off a response body.
    expect(service).not.toMatch(/\.(message|detail|reason)\b/);
  });

  it('never enqueues a replacement operation while settling', () => {
    const service = code(read(`${__dirname}/conflict-resolution.ts`));
    expect(service).not.toContain('enqueue(');
  });

  it('keeps the medical domain dormant', () => {
    const service = code(read(`${__dirname}/conflict-resolution.ts`));
    const presenter = code(read(`${__dirname}/conflict-presenter.ts`));
    // Dormancy is structural, not a name check: the medical registrar is never
    // invoked, so those types have no applier and no presenter entry.
    expect(service).not.toContain('medical_');
    expect(presenter).not.toContain('medical_');
    expect(SUPPORTED_PRESENTER_ENTITY_TYPES).not.toContain('medical_evaluations');
    expect(SUPPORTED_PRESENTER_ENTITY_TYPES).not.toContain('medical_restrictions');

    const layout = code(read(`${SRC_DIR}/app/_layout.tsx`));
    expect(layout).not.toContain('registerMedicalSyncAppliers');
  });
});

describe('the service is the public contract', () => {
  it('exports the resolution entry points a surface needs', () => {
    expect(typeof syncApi.listConflictsForReview).toBe('function');
    expect(typeof syncApi.chooseConflictResolution).toBe('function');
    expect(typeof syncApi.settlePendingResolutions).toBe('function');
    expect(typeof syncApi.reconcileConflictStatuses).toBe('function');
    expect(typeof syncApi.listUnsettledConflicts).toBe('function');
  });
});
