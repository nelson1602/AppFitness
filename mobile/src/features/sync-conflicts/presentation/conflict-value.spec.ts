import { formatCalendarDate, formatInstant, renderValue } from './conflict-value';

/**
 * How one side of a comparison reads — ADR-P030 **C-6**.
 *
 * Two properties are load-bearing. First, the three "no visible value" cases
 * stay three different statements: collapsing them would either hide that data
 * exists (`hidden`), invent data that does not (`absent`), or misreport a
 * deliberately empty answer. Second, **nothing identifier-shaped escapes**: an
 * enum, a token, a catalogue slug or a version string either becomes real words
 * or becomes the withheld phrase — never its stored form, and never a
 * mechanically prettified version of it.
 */

const WITHHELD = { kind: 'key', key: 'sync.conflicts.value.hidden' };

describe('withheld, missing and empty values keep their own meaning', () => {
  it('says a value exists and is not shown', () => {
    expect(renderValue({ state: 'hidden' }, 'notes', 'text', 'en')).toEqual(WITHHELD);
  });

  it('says this side carries no value for the field at all', () => {
    expect(renderValue({ state: 'absent' }, 'notes', 'text', 'en')).toEqual({
      kind: 'key',
      key: 'sync.conflicts.value.absent',
    });
  });

  it('reports a genuinely empty answer in the conflict family’s own words', () => {
    const rendered = renderValue({ state: 'value', value: null }, 'weight_kg', 'number', 'en');

    expect(rendered).toEqual({ kind: 'key', key: 'sync.conflicts.value.notRecorded' });
    expect(rendered).not.toEqual({ kind: 'key', key: 'sync.conflicts.value.absent' });
    expect(rendered).not.toEqual(WITHHELD);
  });
});

describe('numbers, dates and booleans', () => {
  it('formats numbers for the locale', () => {
    expect(renderValue({ state: 'value', value: 1234.5 }, 'weight_kg', 'number', 'en')).toEqual({
      kind: 'text',
      text: '1,234.5',
    });
    expect(renderValue({ state: 'value', value: 1234.5 }, 'weight_kg', 'number', 'es')).toEqual({
      kind: 'text',
      text: '1234,5',
    });
  });

  it('renders booleans through conflict-owned copy, not another feature’s', () => {
    expect(renderValue({ state: 'value', value: true }, 'is_active', 'boolean', 'en')).toEqual({
      kind: 'key',
      key: 'sync.conflicts.value.yes',
    });
    expect(renderValue({ state: 'value', value: false }, 'is_active', 'boolean', 'en')).toEqual({
      kind: 'key',
      key: 'sync.conflicts.value.no',
    });
  });

  it('keeps a stored calendar day on its own day, in both languages', () => {
    const english = renderValue({ state: 'value', value: '2026-03-01' }, 'date', 'date', 'en');
    const spanish = renderValue({ state: 'value', value: '2026-03-01' }, 'date', 'date', 'es');

    // BUG-013: parsed as local midnight, so no timezone shifts it to Feb 28.
    expect(english).toEqual({ kind: 'text', text: 'Mar 1, 2026' });
    expect(spanish.kind === 'text' && spanish.text).toContain('2026');
    expect(spanish.kind === 'text' && spanish.text).not.toContain('2026-03-01');
  });

  it('never prints a raw stored timestamp', () => {
    const rendered = renderValue(
      { state: 'value', value: '2026-03-02T08:00:00.000Z' },
      'started_at',
      'timestamp',
      'en',
    );

    expect(rendered.kind).toBe('text');
    expect(rendered.kind === 'text' && rendered.text).not.toContain('T08:00:00');
  });

  it('withholds an unparseable date or timestamp rather than showing the raw string', () => {
    expect(renderValue({ state: 'value', value: 'not-a-date' }, 'date', 'date', 'en')).toEqual(
      WITHHELD,
    );
    expect(
      renderValue({ state: 'value', value: 'never' }, 'started_at', 'timestamp', 'en'),
    ).toEqual(WITHHELD);
  });
});

describe('controlled values become words, never their stored form', () => {
  it.each([
    ['gender', 'MALE', 'profile.gender.male'],
    ['fitness_level', 'ADVANCED', 'profile.fitness.advanced'],
    ['activity_level', 'VERY_ACTIVE', 'profile.activity.veryActive'],
    ['goal_type', 'MUSCLE_GAIN', 'goal.type.muscleGain'],
    ['category', 'BODYWEIGHT', 'workout.custom.categoryBodyweight'],
    ['exclusion_type', 'avoid_tag', 'nutrition.preferences.categoryChoice'],
    ['kind', 'allergy', 'nutrition.preferences.allergy'],
    ['avoid_tag', 'nut_allergy', 'nutrition.avoid.nuts'],
    ['serving_unit_snapshot', 'cup', 'nutrition.unit.cup'],
  ])('%s = %s reads as approved copy', (field, value, key) => {
    expect(renderValue({ state: 'value', value }, field, 'enum', 'en')).toEqual({
      kind: 'key',
      key,
    });
  });

  it('withholds a member the product ships no wording for', () => {
    // `REHABILITATION` is in the domain union; the goal editor offers seven
    // types and the catalogues word exactly those.
    expect(
      renderValue({ state: 'value', value: 'REHABILITATION' }, 'goal_type', 'enum', 'en'),
    ).toEqual(WITHHELD);
  });

  it('withholds an unknown member rather than prettifying it', () => {
    const rendered = renderValue({ state: 'value', value: 'NON_BINARY_X' }, 'gender', 'enum', 'en');

    expect(rendered).toEqual(WITHHELD);
    expect(JSON.stringify(rendered)).not.toContain('NON_BINARY');
  });

  it('withholds a malformed value of the wrong shape', () => {
    expect(renderValue({ state: 'value', value: 7 }, 'gender', 'enum', 'en')).toEqual(WITHHELD);
  });

  it('withholds any text field it has not classified', () => {
    expect(renderValue({ state: 'value', value: 'whatever' }, 'brand_new', 'text', 'en')).toEqual(
      WITHHELD,
    );
  });
});

describe('token lists', () => {
  it('reads a controlled list as a list of approved labels', () => {
    expect(
      renderValue(
        { state: 'value', value: ['knee', 'lower_back'] },
        'affected_areas',
        'tokens',
        'en',
      ),
    ).toEqual({
      kind: 'keys',
      keys: ['wellness.safety.area.knee', 'wellness.safety.area.lowerBack'],
    });
  });

  it('withholds the whole list when one token is unknown', () => {
    const rendered = renderValue(
      { state: 'value', value: ['knee', 'left_earlobe'] },
      'affected_areas',
      'tokens',
      'en',
    );

    expect(rendered).toEqual(WITHHELD);
    expect(JSON.stringify(rendered)).not.toContain('earlobe');
  });

  it('shows user-typed equipment exactly as the user wrote it', () => {
    expect(
      renderValue(
        { state: 'value', value: ['barbell', 'mis bandas'] },
        'equipment',
        'tokens',
        'en',
      ),
    ).toEqual({ kind: 'text', text: 'barbell, mis bandas' });
  });

  it('reports an empty list as nothing recorded', () => {
    expect(renderValue({ state: 'value', value: [] }, 'equipment', 'tokens', 'en')).toEqual({
      kind: 'key',
      key: 'sync.conflicts.value.notRecorded',
    });
  });
});

describe('catalogue keys resolve to food names, or to nothing', () => {
  it('shows the shipped English name', () => {
    const rendered = renderValue(
      { state: 'value', value: 'food.chicken_breast' },
      'catalog_key_snapshot',
      'text',
      'en',
    );

    expect(rendered.kind).toBe('text');
    expect(rendered.kind === 'text' && rendered.text).not.toContain('food.');
    expect(rendered.kind === 'text' && rendered.text.toLowerCase()).toContain('chicken');
  });

  it('shows the shipped Spanish name', () => {
    const rendered = renderValue(
      { state: 'value', value: 'food.chicken_breast' },
      'catalog_key',
      'text',
      'es',
    );

    expect(rendered).toEqual({ kind: 'text', text: 'Pechuga de pollo, cocida' });
  });

  it('withholds a key the catalogue does not contain', () => {
    const rendered = renderValue(
      { state: 'value', value: 'food.not_a_real_food' },
      'catalog_key',
      'text',
      'en',
    );

    expect(rendered).toEqual(WITHHELD);
    expect(JSON.stringify(rendered)).not.toContain('not_a_real_food');
  });
});

describe('internal identifiers are never shown', () => {
  it.each([
    ['rule_version', 'icoach-v1', 'text'],
    ['catalog_version_snapshot', '2026.03.1', 'text'],
    ['food_revision_snapshot', 4, 'number'],
  ] as const)('%s is withheld', (field, value, kind) => {
    const rendered = renderValue({ state: 'value', value }, field, kind, 'en');

    expect(rendered).toEqual(WITHHELD);
    expect(JSON.stringify(rendered)).not.toContain(String(value));
  });
});

describe('metadata dates', () => {
  it('formats the record’s own day and the moment it was noticed', () => {
    expect(formatCalendarDate('2026-03-01', 'en')).toBe('Mar 1, 2026');
    expect(formatInstant('2026-03-02T08:00:00.000Z', 'en')).not.toContain('T08:00');
  });

  it('returns an unparseable metadata value unchanged rather than guessing', () => {
    expect(formatCalendarDate('nonsense', 'en')).toBe('nonsense');
    expect(formatInstant('nonsense', 'en')).toBe('nonsense');
  });
});
