import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { lightTheme } from '@/shared/theme';

import type { DietaryPreference } from '../domain/dietary-preference';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import { DietaryPreferences } from './DietaryPreferences';
import { PaidWriteDisabledProvider } from '@/shared/presentation';
import { otherLanguageStrings } from '@/shared/localization/language-leak.testkit';

const load = jest.fn();
const add = jest.fn();
const remove = jest.fn();

let mockState: DietaryPreferenceState;
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('../application/dietary-preference.store', () => ({
  useDietaryPreferenceStore: (selector?: (s: DietaryPreferenceState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual('@/shared/localization/resources/en') as {
    en: Record<string, string>;
  };
  const { es } = jest.requireActual('@/shared/localization/resources/es') as {
    es: Record<string, string>;
  };
  const { interpolate } = jest.requireActual('@/shared/localization/format') as {
    interpolate: (value: string, replacements: Record<string, string>) => string;
  };
  return {
    interpolate,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: string) => (mockLanguage === 'es' ? es[key] : en[key]) ?? key,
    }),
  };
});

// Direct SQLite access from the UI is forbidden (persistence must route
// through the store → service → repository). Spy on the database module to
// prove the screen never calls it.
jest.mock('@/shared/infrastructure/database', () => ({
  inTransaction: jest.fn(),
  queryAll: jest.fn(),
  queryFirst: jest.fn(),
  run: jest.fn(),
}));

function setStore(partial: Partial<DietaryPreferenceState>) {
  mockState = {
    status: 'ready',
    preferences: [],
    error: null,
    load,
    add,
    remove,
    ...partial,
  };
}

/**
 * Resolved text colour. Tone is asserted as rendered behaviour rather than by
 * prop name, so "Conflict is warning, never error" cannot regress silently
 * through a rename (BUG-007, applied here by BUG-011).
 */
function colorOf(node: { props: { style?: StyleProp<TextStyle> } }): TextStyle['color'] {
  return StyleSheet.flatten(node.props.style)?.color;
}

const tagPref: DietaryPreference = {
  id: 'dp-1',
  userId: 'u1',
  exclusionType: 'avoid_tag',
  avoidTag: 'nut_allergy',
  catalogKey: null,
  kind: 'allergy',
  hasNote: true,
  version: 1,
  syncStatus: 'pending',
  updatedAt: '2026-07-16T00:00:00.000Z',
};

describe('DietaryPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    add.mockResolvedValue(true);
    remove.mockResolvedValue(true);
  });

  it('loads preferences on mount', async () => {
    setStore({ status: 'loading', preferences: [] });
    await render(<DietaryPreferences />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('shows a loading indicator during the initial load', async () => {
    setStore({ status: 'loading', preferences: [] });
    await render(<DietaryPreferences />);
    expect(screen.getByLabelText('Loading dietary preferences')).toBeOnTheScreen();
  });

  it('shows an empty message when there are no exclusions', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);
    expect(screen.getByText('No exclusions yet.')).toBeOnTheScreen();
  });

  it('renders an active exclusion with its kind, note flag, and remove control', async () => {
    setStore({ status: 'ready', preferences: [tagPref] });
    await render(<DietaryPreferences />);

    expect(screen.getByText('Nuts · category')).toBeOnTheScreen();
    expect(screen.getByText('Allergy / sensitivity · note saved')).toBeOnTheScreen();
    expect(screen.getByTestId('dp-remove-dp-1')).toBeOnTheScreen();
  });

  it('adds an avoid-tag exclusion through the store (default category mode)', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-tag-gluten_sensitive'));
    await fireEvent.press(screen.getByTestId('dp-add'));

    expect(add).toHaveBeenCalledWith({
      exclusionType: 'avoid_tag',
      avoidTag: 'gluten_sensitive',
      kind: 'allergy',
      note: null,
    });
  });

  // BUG-023: the 44×44 touch-target floor (`.ai/08_UI_UX.md`), met at 48.
  it('gives every avoid-tag chip at least a 48×48 touch target', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    const chip = StyleSheet.flatten(screen.getByTestId('dp-tag-gluten_sensitive').props.style);
    expect(chip.minHeight).toBeGreaterThanOrEqual(48);
    expect(chip.minWidth).toBeGreaterThanOrEqual(48);
    // The floor is added, not swapped for the existing chip padding.
    expect(chip).toMatchObject({ paddingHorizontal: 12, paddingVertical: 8 });
  });

  /**
   * BUG-024. A chip wider than its wrapping row neither shrank nor wrapped, so
   * at 1.3× text the Spanish "Preferencia / desagrado" ran past the card edge
   * and clipped. Capping each chip at the row width lets its label wrap.
   */
  it('caps every chip at the row width so a long label wraps instead of clipping', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    const chipIds = ['dp-mode-category', 'dp-mode-food', 'dp-kind-allergy', 'dp-kind-preference'];
    for (const testID of chipIds) {
      const chip = screen.getByTestId(testID);
      const style = StyleSheet.flatten(chip.props.style);
      expect(style.maxWidth).toBe('100%');
      // The BUG-023 floor still holds.
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    }
    const tag = StyleSheet.flatten(screen.getByTestId('dp-tag-gluten_sensitive').props.style);
    expect(tag.maxWidth).toBe('100%');
  });

  /**
   * BUG-024's root cause: the "what" and "why" chip pairs sat in rows that did
   * not wrap, so at 1.3× text the second chip was pushed past the card edge
   * (Spanish and English alike). Every chip row must wrap.
   */
  it('lets every chip row wrap so a chip that no longer fits moves to the next line', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    const root = screen.root;
    if (root === null) throw new Error('DietaryPreferences rendered no root');
    for (const testID of ['dp-mode-category', 'dp-kind-allergy', 'dp-tag-gluten_sensitive']) {
      const [row] = root.queryAll(
        (node) =>
          node.type === 'View' &&
          StyleSheet.flatten(node.props.style)?.flexDirection === 'row' &&
          node.queryAll((child) => child.props.testID === testID).length > 0,
      );
      expect(StyleSheet.flatten(row?.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      });
    }
  });

  it('never truncates a chip label to a fixed number of lines', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    const label = screen.getByText('Preference / dislike');
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.ellipsizeMode).toBeUndefined();
  });

  it('gives every food search result at least a 48-high touch target', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');
    const result = await screen.findByTestId('dp-food-result-food.pomegranate');

    // Full-width row in a column, so only its height needs a floor.
    expect(StyleSheet.flatten(result.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('adds an explicit catalog-food exclusion as soon as a result is chosen', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.press(screen.getByTestId('dp-kind-preference'));
    fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.pomegranate'));

    // Choosing the result is the add: food mode has no separate add button.
    expect(screen.queryByTestId('dp-add')).toBeNull();
    expect(add).toHaveBeenCalledWith({
      exclusionType: 'catalog_key',
      catalogKey: 'food.pomegranate',
      kind: 'preference',
      note: null,
    });
  });

  it('searches a Spanish food label while persisting only its stable catalog key', async () => {
    mockLanguage = 'es';
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    fireEvent.changeText(screen.getByTestId('dp-food-search'), 'granada');
    await fireEvent.press(await screen.findByText('Semillas de granada'));

    expect(screen.getByText('Preferencias y alergias alimentarias')).toBeOnTheScreen();
    expect(add).toHaveBeenCalledWith({
      exclusionType: 'catalog_key',
      catalogKey: 'food.pomegranate',
      kind: 'allergy',
      note: null,
    });
  });

  it('keeps the add action disabled until a selection is made', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);
    expect(screen.getByTestId('dp-add')).toBeDisabled();
  });

  it('removes an exclusion via the soft-delete control', async () => {
    setStore({ status: 'ready', preferences: [tagPref] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-remove-dp-1'));
    expect(remove).toHaveBeenCalledWith('dp-1');
  });

  it('surfaces a safe error banner', async () => {
    setStore({
      status: 'error',
      preferences: [],
      error: 'Your dietary preferences could not be loaded right now.',
    });
    await render(<DietaryPreferences />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
  });

  it('never accesses SQLite directly from the UI while driving its flows', async () => {
    setStore({ status: 'ready', preferences: [tagPref] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-tag-shellfish_allergy'));
    await fireEvent.press(screen.getByTestId('dp-add'));
    await fireEvent.press(screen.getByTestId('dp-remove-dp-1'));

    // Persistence went through the store, not the SQLite layer.
    expect(add).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(jest.mocked(queryAll)).not.toHaveBeenCalled();
    expect(jest.mocked(queryFirst)).not.toHaveBeenCalled();
    expect(jest.mocked(run)).not.toHaveBeenCalled();
  });

  it('renders a distinct web-unavailable state in English with no form, list, or controls (ADR-P019)', async () => {
    setStore({ status: 'web-unavailable', preferences: [] });
    await render(<DietaryPreferences />);

    expect(screen.getByText("Dietary preferences aren't available on the web")).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Use the AppFitnessRD mobile app to manage your allergies and food preferences.',
      ),
    ).toBeOnTheScreen();
    // Header preserved.
    expect(screen.getByText('Dietary preferences and allergies')).toBeOnTheScreen();
    // Not a generic error; no add form, no exclusions list, no remove controls.
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.queryByTestId('dp-add')).toBeNull();
    expect(screen.queryByTestId('dp-mode-category')).toBeNull();
    expect(screen.queryByText('No exclusions yet.')).toBeNull();
  });

  it('renders the web-unavailable state in Spanish', async () => {
    mockLanguage = 'es';
    setStore({ status: 'web-unavailable', preferences: [] });
    await render(<DietaryPreferences />);

    expect(
      screen.getByText('Las preferencias alimentarias no están disponibles en la web'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Usa la app móvil de AppFitnessRD para gestionar tus alergias y preferencias de alimentos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('dp-add')).toBeNull();
  });

  // BUG-011: exclusions are local-first writes that enqueue, and the rows
  // expose `syncStatus` — but the screen rendered nothing for it, so a queued
  // or diverged exclusion looked identical to a fully synced one.
  it('reassures that a queued exclusion is safely stored (BUG-011)', async () => {
    setStore({ preferences: [{ ...tagPref, syncStatus: 'pending' }] });
    await render(<DietaryPreferences />);

    const hint = screen.getByLabelText('Preference saved on this device; sync pending');
    expect(hint).toBeOnTheScreen();
    // Pending means safely stored — it must reassure, never alarm.
    expect(colorOf(hint)).toBe(lightTheme.colors.onSurfaceVariant);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
  });

  it('reports a diverged exclusion as warning, not error (BUG-011)', async () => {
    setStore({ preferences: [{ ...tagPref, syncStatus: 'conflict' }] });
    await render(<DietaryPreferences />);

    const hint = screen.getByLabelText('Dietary preference sync conflict');
    expect(hint).toBeOnTheScreen();
    expect(colorOf(hint)).toBe(lightTheme.colors.warning);
    expect(colorOf(hint)).not.toBe(lightTheme.colors.error);
    // A conflicted row is not also reported as merely pending.
    expect(
      screen.queryByLabelText('Preference saved on this device; sync pending'),
    ).not.toBeOnTheScreen();
  });

  it('leaves a synced exclusion with no sync hint at all (BUG-011)', async () => {
    setStore({ preferences: [{ ...tagPref, syncStatus: 'synced' }] });
    await render(<DietaryPreferences />);

    expect(screen.queryByLabelText('Dietary preference sync conflict')).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Preference saved on this device; sync pending'),
    ).not.toBeOnTheScreen();
  });

  it('reports the conflict without offering a resolution (BUG-012 stays open)', async () => {
    setStore({ preferences: [{ ...tagPref, syncStatus: 'conflict' }] });
    await render(<DietaryPreferences />);

    // Report-only: the hint is the bare localized word, with no choose action.
    expect(screen.getByLabelText('Dietary preference sync conflict')).toHaveTextContent(
      'Sync conflict',
    );
  });

  it('localizes the conflict hint in Spanish (BUG-011)', async () => {
    mockLanguage = 'es';
    setStore({ preferences: [{ ...tagPref, syncStatus: 'conflict' }] });
    await render(<DietaryPreferences />);

    expect(
      screen.getByLabelText('Conflicto de sincronización de la preferencia alimentaria'),
    ).toHaveTextContent('Conflicto de sincronización');
  });

  it('localizes the pending hint in Spanish (BUG-011)', async () => {
    mockLanguage = 'es';
    setStore({ preferences: [{ ...tagPref, syncStatus: 'pending' }] });
    await render(<DietaryPreferences />);

    expect(
      screen.getByLabelText('Preferencia guardada en este dispositivo; sincronización pendiente'),
    ).toHaveTextContent('Pendiente de sincronizar');
  });
  /**
   * ADR-P022 Addendum A. The active chip fills with `primary` and previously
   * labelled itself through the default tone, which resolves to `onSurface`:
   * 1.42:1 in the dark theme. The canonical filled pair is `primary` /
   * `onPrimary` (ADR-P022 Decision 5a). Asserted on the resolved colour, so a
   * tone rename cannot reintroduce the defect silently.
   */
  it('labels the active chip with onPrimary, never onSurface (ADR-P022 Addendum A)', async () => {
    setStore({});
    await render(<DietaryPreferences />);

    const activeLabel = screen.getByText('A category');
    expect(colorOf(activeLabel)).toBe(lightTheme.colors.onPrimary);
    expect(colorOf(activeLabel)).not.toBe(lightTheme.colors.onSurface);

    // The inactive sibling keeps the muted foreground over its recessed fill.
    expect(colorOf(screen.getByText('A specific food'))).toBe(lightTheme.colors.onSurfaceVariant);
  });

  /**
   * ADR-P022 Addendum A. `outline` is a >=3:1 boundary role; as placeholder
   * *text* it measures 4.49:1 on `surface` in the light theme and fails the
   * 4.5:1 threshold. `onSurfaceVariant` is the canonical placeholder role.
   */
  it('renders placeholder text through onSurfaceVariant, never outline (ADR-P022 Addendum A)', async () => {
    setStore({});
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    for (const testID of ['dp-food-search', 'dp-note']) {
      const input = screen.getByTestId(testID);
      expect(input.props.placeholderTextColor).toBe(lightTheme.colors.onSurfaceVariant);
      expect(input.props.placeholderTextColor).not.toBe(lightTheme.colors.outline);
    }
  });
});

/**
 * UX-5 (Nutrition slice) and BUG-027. Both raw REDUCED-family inputs now render
 * through `AppTextInput`, gaining the FULL-family floor, fill, type token and
 * focus border. The encryption notice moved out of the note placeholder, where
 * it clipped at large text and vanished on typing, into persistent helper copy.
 */
describe('DietaryPreferences inputs (UX-5, BUG-027)', () => {
  const EN_HELPER = 'Encrypted on your device.';
  const ES_HELPER = 'Cifrada en tu dispositivo.';

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    add.mockResolvedValue(true);
    setStore({ status: 'ready', preferences: [] });
  });

  it.each([
    ['en', 'Search foods to exclude', 'Optional note'],
    ['es', 'Buscar alimentos para excluir', 'Nota opcional'],
  ] as const)(
    'keeps the frozen test IDs on the nodes that carry the accessible names (%s)',
    async (language, searchName, noteName) => {
      mockLanguage = language;
      await render(<DietaryPreferences />);
      await fireEvent.press(screen.getByTestId('dp-mode-food'));

      expect(screen.getByLabelText(searchName).props.testID).toBe('dp-food-search');
      expect(screen.getByLabelText(noteName).props.testID).toBe('dp-note');
    },
  );

  it('gives both inputs the FULL-family 48 dp floor, fill, type token and focus border', async () => {
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    for (const testID of ['dp-food-search', 'dp-note']) {
      const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style).toMatchObject({
        backgroundColor: lightTheme.colors.surfaceVariant,
        borderColor: lightTheme.colors.outline,
        borderWidth: 1,
        color: lightTheme.colors.onSurface,
        paddingHorizontal: 12,
        fontSize: 16,
        lineHeight: 24,
      });
      // The REDUCED all-round padding is gone.
      expect(style.padding).toBeUndefined();
      expect(screen.getByTestId(testID).props.allowFontScaling).toBe(true);

      await fireEvent(screen.getByTestId(testID), 'focus');
      expect(StyleSheet.flatten(screen.getByTestId(testID).props.style).borderWidth).toBe(2);
    }
  });

  it('keeps both inputs controlled: the typed value round-trips through state', async () => {
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pome');
    expect(screen.getByTestId('dp-food-search').props.value).toBe('pome');
    await fireEvent.changeText(screen.getByTestId('dp-note'), 'reacts badly');
    expect(screen.getByTestId('dp-note').props.value).toBe('reacts badly');
  });

  it('clears the search after an add so the next food can be searched', async () => {
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.pomegranate'));

    await waitFor(() => expect(screen.getByTestId('dp-food-search').props.value).toBe(''));
    expect(screen.queryByTestId('dp-food-result-food.pomegranate')).toBeNull();
    // The field stays usable for the next food.
    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranat');
    expect(await screen.findByTestId('dp-food-result-food.pomegranate')).toBeOnTheScreen();
  });

  it('keeps the query when the store rejects the add', async () => {
    add.mockResolvedValue(false);
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.pomegranate'));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('dp-food-search').props.value).toBe('pomegranate');
  });

  it.each([
    ['en', 'Optional note', EN_HELPER],
    ['es', 'Nota opcional', ES_HELPER],
  ] as const)(
    'moves the encryption notice out of the placeholder into persistent muted helper copy (%s)',
    async (language, placeholder, helper) => {
      mockLanguage = language;
      await render(<DietaryPreferences />);

      expect(screen.getByTestId('dp-note').props.placeholder).toBe(placeholder);
      const helperText = screen.getByText(helper);
      expect(StyleSheet.flatten(helperText.props.style)).toMatchObject({
        color: lightTheme.colors.onSurfaceVariant,
        fontSize: 12,
      });
    },
  );

  it('keeps the privacy helper visible while and after the note is typed', async () => {
    await render(<DietaryPreferences />);
    expect(screen.getByText(EN_HELPER)).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('dp-note'), 'focus');
    await fireEvent.changeText(screen.getByTestId('dp-note'), 'Severe peanut reaction');
    expect(screen.getByText(EN_HELPER)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('dp-note'), 'blur');
    expect(screen.getByText(EN_HELPER)).toBeOnTheScreen();
  });

  it('hands the trimmed note to the store, clears it on success and never renders it', async () => {
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-tag-nut_allergy'));
    await fireEvent.changeText(screen.getByTestId('dp-note'), '  Severe peanut reaction  ');
    await fireEvent.press(screen.getByTestId('dp-add'));

    // Encryption happens below the store (repository); the screen only passes it on.
    expect(add).toHaveBeenCalledWith({
      exclusionType: 'avoid_tag',
      avoidTag: 'nut_allergy',
      kind: 'allergy',
      note: 'Severe peanut reaction',
    });
    await waitFor(() => expect(screen.getByTestId('dp-note').props.value).toBe(''));
    expect(screen.queryByText(/Severe peanut reaction/)).not.toBeOnTheScreen();
    expect(screen.getByText(EN_HELPER)).toBeOnTheScreen();
  });

  it('keeps the typed note when the store rejects the add', async () => {
    add.mockResolvedValue(false);
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-tag-nut_allergy'));
    await fireEvent.changeText(screen.getByTestId('dp-note'), 'Severe peanut reaction');
    await fireEvent.press(screen.getByTestId('dp-add'));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('dp-note').props.value).toBe('Severe peanut reaction');
  });

  it('sends a whitespace-only note as null', async () => {
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-tag-nut_allergy'));
    await fireEvent.changeText(screen.getByTestId('dp-note'), '   ');
    await fireEvent.press(screen.getByTestId('dp-add'));

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });
});

describe('S-4 read-only write boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps saved exclusions visible while chips and add stay inert', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(
      <PaidWriteDisabledProvider disabled>
        <DietaryPreferences />
      </PaidWriteDisabledProvider>,
    );

    const chip = screen.getByTestId('dp-tag-gluten_sensitive');
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(chip);
    expect(screen.getByTestId('dp-tag-gluten_sensitive').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByTestId('dp-add'));
    expect(add).not.toHaveBeenCalled();
  });
});

/**
 * v10 Block B item 8 (owner): choosing a search result adds the food to the
 * excluded list at once, as a chip with its Spanish name and an X to remove it.
 * The "Seleccionado: Soy milk, unsweetened" line is gone. It also showed the
 * English name, because the lookup went through the canonical catalogue's UUID
 * ids, which the Spanish table never matched.
 */
describe('DietaryPreferences exclusion picker (v10 item 8)', () => {
  const soyPref: DietaryPreference = {
    ...tagPref,
    id: 'dp-soy',
    exclusionType: 'catalog_key',
    avoidTag: null,
    catalogKey: 'food.soy_milk_unsweet',
    hasNote: false,
    syncStatus: 'synced',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'es';
    remove.mockResolvedValue(true);
    setStore({ status: 'ready', preferences: [] });
    // The store appends the saved row, as the real one does after a local write.
    add.mockImplementation(async (input: { catalogKey?: string }) => {
      if (input.catalogKey === 'food.soy_milk_unsweet') {
        mockState = { ...mockState, preferences: [...mockState.preferences, soyPref] };
      }
      return true;
    });
  });

  it('adds the chosen result as a Spanish chip whose X removes it', async () => {
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'leche de soya');
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.soy_milk_unsweet'));

    expect(add).toHaveBeenCalledWith({
      exclusionType: 'catalog_key',
      catalogKey: 'food.soy_milk_unsweet',
      kind: 'allergy',
      note: null,
    });
    const chip = await screen.findByTestId('dp-excluded-dp-soy');
    expect(chip).toHaveTextContent('Leche de soya sin azúcar');
    expect(screen.getByText('Alimentos excluidos')).toBeOnTheScreen();

    const x = screen.getByLabelText('Quitar Leche de soya sin azúcar');
    expect(x.props.testID).toBe('dp-excluded-dp-soy-remove');
    await fireEvent.press(x);
    expect(remove).toHaveBeenCalledWith('dp-soy');
  });

  it.each(['es', 'en'] as const)(
    'never renders a "Seleccionado" / "Selected" line (%s)',
    async (language) => {
      mockLanguage = language;
      await render(<DietaryPreferences />);
      await fireEvent.press(screen.getByTestId('dp-mode-food'));
      await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'soy milk');
      await fireEvent.press(await screen.findByTestId('dp-food-result-food.soy_milk_unsweet'));

      expect(screen.queryByText(/Seleccionado|Selected/)).toBeNull();
    },
  );

  it('shows Spanish names in the results, even for an English query', async () => {
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'soy milk');

    expect(await screen.findByTestId('dp-food-result-food.soy_milk_unsweet')).toHaveTextContent(
      'Leche de soya sin azúcar',
    );
    expect(screen.queryByText('Soy milk, unsweetened')).toBeNull();
  });

  it('shows the English name in English', async () => {
    mockLanguage = 'en';
    setStore({ status: 'ready', preferences: [soyPref] });
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    expect(screen.getByTestId('dp-excluded-dp-soy')).toHaveTextContent('Soy milk, unsweetened');
    expect(screen.getByLabelText('Remove Soy milk, unsweetened')).toBeOnTheScreen();
    expect(screen.getByText('Excluded foods')).toBeOnTheScreen();
  });

  it('shows the Spanish name in the exclusions list too', async () => {
    setStore({ status: 'ready', preferences: [soyPref] });
    await render(<DietaryPreferences />);

    expect(screen.getByText('Leche de soya sin azúcar · alimento')).toBeOnTheScreen();
  });

  it('marks an already-excluded food in the results and never adds it twice', async () => {
    setStore({ status: 'ready', preferences: [soyPref] });
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'leche de soya');

    const result = await screen.findByTestId('dp-food-result-food.soy_milk_unsweet');
    expect(result).toHaveTextContent('Leche de soya sin azúcar · Ya excluido');
    expect(result.props.accessibilityState).toMatchObject({ selected: true, disabled: true });
    await fireEvent.press(result);
    expect(add).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('dp-excluded-dp-soy')).toHaveLength(1);
  });

  it('gives the chip X at least a 48 by 48 touch target', async () => {
    setStore({ status: 'ready', preferences: [soyPref] });
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));

    const x = StyleSheet.flatten(screen.getByTestId('dp-excluded-dp-soy-remove').props.style);
    expect(x.minHeight).toBeGreaterThanOrEqual(48);
    expect(x.minWidth).toBeGreaterThanOrEqual(48);
  });

  it('keeps the X and the results inert while a write is saving', async () => {
    setStore({ status: 'saving', preferences: [soyPref] });
    await render(<DietaryPreferences />);
    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');

    const x = screen.getByTestId('dp-excluded-dp-soy-remove');
    expect(x.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(x);
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.pomegranate'));
    expect(remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it.each(['es', 'en'] as const)(
    'leaks no other-language copy in the picker (%s)',
    async (language) => {
      mockLanguage = language;
      setStore({ status: 'ready', preferences: [soyPref] });
      await render(<DietaryPreferences />);
      await fireEvent.press(screen.getByTestId('dp-mode-food'));
      await fireEvent.changeText(screen.getByTestId('dp-food-search'), 'soy');

      expect(otherLanguageStrings(screen.root, language)).toEqual([]);
    },
  );
});
