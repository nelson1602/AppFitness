import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryAll, queryFirst, run } from '@/shared/infrastructure/database';

import type { DietaryPreference } from '../domain/dietary-preference';
import type { DietaryPreferenceState } from '../application/dietary-preference.store';
import { DietaryPreferences } from './DietaryPreferences';

const load = jest.fn();
const add = jest.fn();
const remove = jest.fn();

let mockState: DietaryPreferenceState;

jest.mock('../application/dietary-preference.store', () => ({
  useDietaryPreferenceStore: (selector?: (s: DietaryPreferenceState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));

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
});
