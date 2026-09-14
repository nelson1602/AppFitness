import { SUPPORTED_PRESENTER_ENTITY_TYPES } from '@/shared/infrastructure/sync';
import { en } from '@/shared/localization/resources/en';

import {
  BLOCKER_COPY,
  CHOICE_COPY,
  COMPARISON,
  fieldLabel,
  recordLabel,
  REFUSAL_COPY,
  SETTLEMENT_CHIP,
  SIDE,
  VALUE_STATE,
} from './conflict-copy';

/**
 * The label maps, checked against the **presenter** rather than against
 * themselves — ADR-P030 §Decision 2.
 *
 * The presenter's allow-list is the authority on what this surface can be
 * asked to name. Reading the entity types from its export and the field
 * identifiers from its source means a new entity or column makes this fail,
 * instead of reaching a user as a raw identifier.
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

const PRESENTER = `${__dirname}/../../../shared/infrastructure/sync/conflict-presenter.ts`;

/** Every identifier the allow-list can emit: the shown specs plus the hidden. */
function presenterFields(): string[] {
  const source = require('node:fs').readFileSync(PRESENTER, 'utf8');
  const block = source.slice(
    source.indexOf('const PRESENTERS'),
    source.indexOf('const ENTITY_STRUCTURAL_KEYS'),
  );
  const shown = [...block.matchAll(/\{ field: '([a-z_]+)', kind: '\w+' \}/g)].map((m) => m[1]);
  const hidden = [...block.matchAll(/hidden: \[([^\]]*)\]/g)].flatMap((m) =>
    m[1]
      .split(',')
      .map((token: string) => token.trim().replace(/'/g, ''))
      .filter(Boolean),
  );
  return [...new Set([...shown, ...hidden])];
}

const catalogue = en as Record<string, string>;

describe('record labels cover exactly the registered entity types', () => {
  it('labels all 13, and only those', () => {
    expect(SUPPORTED_PRESENTER_ENTITY_TYPES).toHaveLength(13);
    for (const entityKind of SUPPORTED_PRESENTER_ENTITY_TYPES) {
      const key = recordLabel(entityKind);
      expect(key).toBe(`sync.conflicts.record.${entityKind}`);
      expect(catalogue[key as string]).toBeTruthy();
    }
  });

  it('registers no label without a registered entity behind it', () => {
    const registered = new Set(SUPPORTED_PRESENTER_ENTITY_TYPES);
    const labelled = Object.keys(catalogue)
      .filter((key) => key.startsWith('sync.conflicts.record.'))
      .map((key) => key.replace('sync.conflicts.record.', ''));
    expect(labelled).toHaveLength(13);
    expect(labelled.filter((entityKind) => !registered.has(entityKind))).toEqual([]);
  });

  it('names no medical entity — the medical appliers are never registered', () => {
    expect(recordLabel('medical_evaluations')).toBeNull();
    expect(recordLabel('medical_restrictions')).toBeNull();
    expect(Object.keys(catalogue).filter((key) => key.includes('medical'))).toEqual([]);
  });

  it('refuses an unregistered kind instead of naming it', () => {
    expect(recordLabel('something_new')).toBeNull();
  });
});

describe('field labels cover exactly the allow-listed identifiers', () => {
  const fields = presenterFields();

  it('labels all 75, and only those', () => {
    expect(fields).toHaveLength(75);
    for (const field of fields) {
      const key = fieldLabel(field);
      expect(key).toBe(`sync.conflicts.field.${field}`);
      expect(catalogue[key as string]).toBeTruthy();
    }
  });

  it('registers no label without an allow-listed field behind it', () => {
    const allowed = new Set(fields);
    const labelled = Object.keys(catalogue)
      .filter((key) => key.startsWith('sync.conflicts.field.'))
      .map((key) => key.replace('sync.conflicts.field.', ''));
    expect(labelled).toHaveLength(75);
    expect(labelled.filter((field) => !allowed.has(field))).toEqual([]);
  });

  it('refuses an unknown column instead of printing its name', () => {
    expect(fieldLabel('brand_new_column')).toBeNull();
  });
});

describe('every other mapping resolves to real catalogue copy', () => {
  const keys = [
    ...Object.values(SETTLEMENT_CHIP),
    ...Object.values(VALUE_STATE),
    ...Object.values(COMPARISON),
    ...Object.values(SIDE),
    ...Object.values(CHOICE_COPY).flatMap((copy) => [
      copy.label,
      copy.description,
      copy.accessibility,
    ]),
    ...Object.values(BLOCKER_COPY).flatMap((copy) => [copy.title, copy.body]),
    ...Object.values(REFUSAL_COPY).flatMap((copy) => [copy.title, copy.body]),
  ];

  it.each(keys)('%s exists', (key) => {
    expect(catalogue[key]).toBeTruthy();
  });

  it('covers every settlement condition and every value state', () => {
    expect(Object.keys(SETTLEMENT_CHIP).sort()).toEqual([
      'BLOCKED',
      'CHOICE_RECORDED',
      'RETRYING',
      'SETTLED',
      'UNDECIDED',
    ]);
    expect(Object.keys(VALUE_STATE).sort()).toEqual(['absent', 'hidden']);
    expect(Object.keys(COMPARISON).sort()).toEqual(['different', 'same', 'unknown']);
  });

  it('keeps hidden and absent distinct, so neither can read as the other', () => {
    expect(VALUE_STATE.hidden).not.toBe(VALUE_STATE.absent);
    expect(catalogue[VALUE_STATE.hidden]).not.toBe(catalogue[VALUE_STATE.absent]);
  });

  it('gives both sides wording that differs as text, not as colour', () => {
    expect(catalogue[SIDE.local]).not.toBe(catalogue[SIDE.server]);
    expect(catalogue[SIDE.local]).toBeTruthy();
    expect(catalogue[SIDE.server]).toBeTruthy();
  });

  it('gives each choice a label, a consequence and its own accessible name', () => {
    for (const copy of Object.values(CHOICE_COPY)) {
      expect(catalogue[copy.label]).toBeTruthy();
      expect(catalogue[copy.description]).toBeTruthy();
      expect(catalogue[copy.accessibility]).toBeTruthy();
    }
    expect(catalogue[CHOICE_COPY.RESOLVED_LOCAL_WINS.label]).not.toBe(
      catalogue[CHOICE_COPY.RESOLVED_SERVER_WINS.label],
    );
  });
});
