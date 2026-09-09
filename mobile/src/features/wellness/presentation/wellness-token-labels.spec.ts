import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
} from '../domain/wellness-safety-profile';
import {
  AFFECTED_AREA_LABEL_KEY,
  MOVEMENT_LABEL_KEY,
  affectedAreaOptions,
  movementOptions,
} from './wellness-token-labels';

/**
 * ADR-P017 **W-3** label boundary.
 *
 * Every token in both closed vocabularies must have an authored label in **both**
 * catalogs — an unlabelled chip would either render a raw token or nothing at
 * all, and a token with only English copy would be an ES parity hole. The maps
 * are typed by the token union so a missing entry fails `tsc`, but that says
 * nothing about the catalogs, which is what these assertions cover.
 */

const CATALOGS: [name: string, catalog: Record<string, string>][] = [
  ['en', en],
  ['es', es],
];

describe('affected-area labels', () => {
  it('covers exactly the shipped vocabulary, with no extra entries', () => {
    expect(Object.keys(AFFECTED_AREA_LABEL_KEY).sort()).toEqual(
      [...WELLNESS_AFFECTED_AREAS].sort(),
    );
    expect(WELLNESS_AFFECTED_AREAS).toHaveLength(18);
  });

  it.each(CATALOGS)('has a non-empty %s label for every token', (_name, catalog) => {
    for (const token of WELLNESS_AFFECTED_AREAS) {
      const label = catalog[AFFECTED_AREA_LABEL_KEY[token]];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(CATALOGS)('gives every token a distinct %s label', (_name, catalog) => {
    const labels = WELLNESS_AFFECTED_AREAS.map((token) => catalog[AFFECTED_AREA_LABEL_KEY[token]]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('excludes head, which W-1 deliberately left out of the vocabulary', () => {
    expect(Object.keys(AFFECTED_AREA_LABEL_KEY)).not.toContain('head');
  });
});

describe('movement labels', () => {
  it('covers exactly the shipped vocabulary, with no extra entries', () => {
    expect(Object.keys(MOVEMENT_LABEL_KEY).sort()).toEqual([...WELLNESS_MOVEMENTS_TO_AVOID].sort());
    expect(WELLNESS_MOVEMENTS_TO_AVOID).toHaveLength(18);
  });

  it.each(CATALOGS)('has a non-empty %s label for every token', (_name, catalog) => {
    for (const token of WELLNESS_MOVEMENTS_TO_AVOID) {
      const label = catalog[MOVEMENT_LABEL_KEY[token]];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(CATALOGS)('gives every token a distinct %s label', (_name, catalog) => {
    const labels = WELLNESS_MOVEMENTS_TO_AVOID.map((token) => catalog[MOVEMENT_LABEL_KEY[token]]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('excludes behind_neck_press, which no shipped exercise declares', () => {
    expect(Object.keys(MOVEMENT_LABEL_KEY)).not.toContain('behind_neck_press');
  });
});

describe('the whole W-3 copy family has exact EN/ES parity', () => {
  const wellnessKeys = Object.keys(en).filter((key) => key.startsWith('wellness.'));

  it('authors every wellness key in both catalogs', () => {
    expect(wellnessKeys.length).toBeGreaterThan(0);
    for (const key of wellnessKeys) {
      expect(Object.keys(es)).toContain(key);
      expect((es as Record<string, string>)[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('adds no ES-only wellness key', () => {
    const spanishOnly = Object.keys(es).filter(
      (key) => key.startsWith('wellness.') && !(key in en),
    );
    expect(spanishOnly).toEqual([]);
  });

  it('translates rather than transliterating: no ES value equals its EN value by accident', () => {
    // Proper nouns and format tokens legitimately match; everything else must
    // differ, which is the cheap guard against an untranslated paste.
    const IDENTICAL_BY_DESIGN = new Set([
      'wellness.safety.area.abdomen',
      'wellness.safety.movement.dips',
    ]);
    const identical = wellnessKeys.filter(
      (key) =>
        !IDENTICAL_BY_DESIGN.has(key) &&
        (en as Record<string, string>)[key] === (es as Record<string, string>)[key],
    );
    expect(identical).toEqual([]);
  });
});

describe('options are built from tokens, in token order', () => {
  const t = ((key: string) => `label:${key}`) as unknown as Parameters<
    typeof affectedAreaOptions
  >[0];

  it('keeps the vocabulary order, so the layout is language-independent', () => {
    expect(affectedAreaOptions(t).map((option) => option.value)).toEqual([
      ...WELLNESS_AFFECTED_AREAS,
    ]);
    expect(movementOptions(t).map((option) => option.value)).toEqual([
      ...WELLNESS_MOVEMENTS_TO_AVOID,
    ]);
  });

  it('resolves each label through the localization boundary', () => {
    expect(affectedAreaOptions(t)[0]).toEqual({
      value: 'abdomen',
      label: 'label:wellness.safety.area.abdomen',
    });
  });
});
