import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { DietaryPreference } from '../domain/dietary-preference';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import { DietaryPreferences } from './DietaryPreferences';

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
  return {
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

  it('adds an explicit catalog-food exclusion via search and selection', async () => {
    setStore({ status: 'ready', preferences: [] });
    await render(<DietaryPreferences />);

    await fireEvent.press(screen.getByTestId('dp-mode-food'));
    await fireEvent.press(screen.getByTestId('dp-kind-preference'));
    fireEvent.changeText(screen.getByTestId('dp-food-search'), 'pomegranate');
    await fireEvent.press(await screen.findByTestId('dp-food-result-food.pomegranate'));
    await fireEvent.press(screen.getByTestId('dp-add'));

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
    await fireEvent.press(screen.getByTestId('dp-add'));

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
        'Use the AppFitness mobile app to manage your allergies and food preferences.',
      ),
    ).toBeOnTheScreen();
    // Header preserved.
    expect(screen.getByText('Dietary preferences & allergies')).toBeOnTheScreen();
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
        'Usa la app móvil de AppFitness para gestionar tus alergias y preferencias de alimentos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('dp-add')).toBeNull();
  });
});
