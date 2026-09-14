import { AFFECTED_AREA_LABEL_KEY, MOVEMENT_LABEL_KEY } from '@/features/wellness';
import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { CONTROLLED_VOCABULARIES, resolveTerm, vocabularyFor } from './conflict-vocabulary';

/**
 * The stored-value vocabulary, checked against the **presenter** — ADR-P030
 * §Decision 2, C-6.
 *
 * The classification has to be *total* over the identifier-shaped fields the
 * allow-list can emit, or a storage token reaches a user through whichever one
 * was forgotten. So the field list is read from the presenter's own source and
 * every `enum`, `tokens` and `text` field must be accounted for here.
 */

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `transaction-threading.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
};

const PRESENTER = `${__dirname}/../../../shared/infrastructure/sync/conflict-presenter.ts`;

/** Every shown field the allow-list declares, with the kind it declares it as. */
function shownFields(): { field: string; kind: string }[] {
  const source = require('node:fs').readFileSync(PRESENTER, 'utf8');
  const block = source.slice(
    source.indexOf('const PRESENTERS'),
    source.indexOf('const ENTITY_STRUCTURAL_KEYS'),
  );
  return [...block.matchAll(/\{ field: '([a-z_]+)', kind: '(\w+)' \}/g)].map((m) => ({
    field: m[1],
    kind: m[2],
  }));
}

/** The kinds whose stored form is an identifier unless proven otherwise. */
const TERM_KINDS = ['text', 'enum', 'tokens'];

const english = en as Record<string, string>;
const spanish = es as Record<string, string>;

describe('the classification is total over identifier-shaped fields', () => {
  const fields = shownFields();

  it('reads a non-trivial field list from the presenter', () => {
    expect(fields.length).toBeGreaterThanOrEqual(60);
  });

  it('classifies every shown text, enum and token field', () => {
    const unclassified = fields
      .filter((entry) => TERM_KINDS.includes(entry.kind))
      .filter((entry) => vocabularyFor(entry.field) === null)
      .map((entry) => `${entry.field}:${entry.kind}`);

    expect(unclassified).toEqual([]);
  });

  it('leaves numeric and temporal fields to the ordinary path', () => {
    // Over-classifying would route a plain measurement through the vocabulary.
    const overClassified = fields
      .filter((entry) => !TERM_KINDS.includes(entry.kind))
      .filter((entry) => vocabularyFor(entry.field) !== null)
      .map((entry) => `${entry.field}:${entry.kind}`);

    // `food_revision_snapshot` is the deliberate exception: a number that is an
    // identifier, and therefore never shown.
    expect(overClassified).toEqual(['food_revision_snapshot:number']);
  });

  it('classifies nothing it was not asked about', () => {
    expect(vocabularyFor('weight_kg')).toBeNull();
    expect(vocabularyFor('made_up_column')).toBeNull();
  });
});

describe('every controlled vocabulary is exhaustive and real', () => {
  const tables = Object.entries(CONTROLLED_VOCABULARIES);

  it('covers nine closed domains', () => {
    expect(tables).toHaveLength(9);
  });

  it.each(tables)('%s maps every member to shipped EN/ES copy or to nothing', (_name, table) => {
    const entries = Object.entries(table as Record<string, string | null>);
    expect(entries.length).toBeGreaterThan(0);

    for (const [member, key] of entries) {
      if (key === null) continue;
      expect([member, english[key]]).toEqual([member, expect.any(String)]);
      expect([member, spanish[key]]).toEqual([member, expect.any(String)]);
      expect(english[key]).toBeTruthy();
      expect(spanish[key]).toBeTruthy();
    }
  });

  /**
   * Serving units are the one domain where the stored form and the word are
   * legitimately the same string: `g` is the abbreviation, shipped as such and
   * rendered identically on every nutrition surface. It is real copy that
   * happens to match, not an identifier passed through.
   */
  const STORED_FORM_IS_THE_WORD = ['SERVING_UNIT'];

  it.each(tables.filter(([name]) => !STORED_FORM_IS_THE_WORD.includes(name)))(
    '%s never maps a member to its own stored form',
    (_name, table) => {
      for (const [member, key] of Object.entries(table as Record<string, string | null>)) {
        if (key === null) continue;
        expect(english[key]).not.toBe(member);
        expect(spanish[key]).not.toBe(member);
      }
    },
  );

  it('routes serving units through approved copy even where the word matches', () => {
    // The mapping must still exist: a unit outside the domain is withheld, not
    // echoed, which an identity pass-through would not do.
    expect(resolveTerm('serving_unit_snapshot', 'g', 'en')).toEqual({
      kind: 'key',
      key: 'nutrition.unit.g',
    });
    expect(resolveTerm('serving_unit_snapshot', 'furlong', 'en')).toBeNull();
  });
});

describe('the wellness token vocabularies are reused, not re-authored', () => {
  it('maps areas and movements through the shipped W-3 label maps', () => {
    for (const [token, key] of Object.entries(AFFECTED_AREA_LABEL_KEY)) {
      expect(resolveTerm('affected_areas', token, 'en')).toEqual({ kind: 'key', key });
    }
    for (const [token, key] of Object.entries(MOVEMENT_LABEL_KEY)) {
      expect(resolveTerm('movements_to_avoid', token, 'en')).toEqual({ kind: 'key', key });
    }
  });

  it('refuses a token neither vocabulary contains', () => {
    expect(resolveTerm('affected_areas', 'left_earlobe', 'en')).toBeNull();
    expect(resolveTerm('movements_to_avoid', 'moonwalk', 'en')).toBeNull();
  });
});

describe('fail-closed resolution', () => {
  it('refuses an unclassified field outright', () => {
    expect(resolveTerm('brand_new_column', 'anything', 'en')).toBeNull();
  });

  it('refuses every internal identifier', () => {
    expect(resolveTerm('rule_version', 'icoach-v1', 'en')).toBeNull();
    expect(resolveTerm('catalog_version_snapshot', '2026.03.1', 'en')).toBeNull();
    expect(resolveTerm('food_revision_snapshot', 4, 'en')).toBeNull();
  });

  it('refuses a blank or non-string free-text value', () => {
    expect(resolveTerm('name', '   ', 'en')).toBeNull();
    expect(resolveTerm('muscle_group', 42, 'en')).toBeNull();
  });

  it('keeps genuinely user-authored text exactly as written', () => {
    expect(resolveTerm('muscle_group', 'mis piernas', 'en')).toEqual({
      kind: 'text',
      text: 'mis piernas',
    });
    expect(resolveTerm('name', 'Bulgarian split squat', 'en')).toEqual({
      kind: 'text',
      text: 'Bulgarian split squat',
    });
  });

  it('never underscore-splits or title-cases an identifier into fake copy', () => {
    for (const value of ['MUSCLE_GAIN', 'lower_back', 'food.chicken_breast']) {
      // Each of these is a real member of *some other* field's domain, so a
      // mechanical prettifier would happily produce words for all of them.
      expect(resolveTerm('gender', value, 'en')).toBeNull();
    }
  });
});
