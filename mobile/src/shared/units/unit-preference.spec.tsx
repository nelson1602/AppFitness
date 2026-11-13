import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as ReactNative from 'react-native';

import { darkColors, lightColors } from '@/shared/theme';

import {
  getUnitSnapshot,
  initializeUnits,
  resetUnitsForTests,
  setHeightUnit,
  setWeightUnit,
} from './unit-manager';
import { UnitSelector } from './unit-selector';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

const getItem = jest.mocked(SecureStore.getItemAsync);
const setItem = jest.mocked(SecureStore.setItemAsync);
const deleteItem = jest.mocked(SecureStore.deleteItemAsync);

/** A fake SecureStore holding `entries`. */
function stored(entries: Record<string, string>) {
  getItem.mockImplementation(async (key: string) => entries[key] ?? null);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetUnitsForTests();
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue();
  deleteItem.mockResolvedValue();
});

describe('unit preferences (v11-B: weight and height apart)', () => {
  it('starts in kg and cm, as before, when nothing is stored', async () => {
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ weight: 'kg', height: 'cm', status: 'ready' });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('loads the two stored choices, which may differ (lb + cm)', async () => {
    stored({ 'appfitness.weight-unit': 'lb', 'appfitness.height-unit': 'cm' });
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ weight: 'lb', height: 'cm', status: 'ready' });
  });

  it('migrates the v10 single choice once: imperial → lb + ft-in, then removes it', async () => {
    stored({ 'appfitness.unit-system': 'imperial' });
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ weight: 'lb', height: 'ft-in', status: 'ready' });
    expect(setItem).toHaveBeenCalledWith('appfitness.weight-unit', 'lb');
    expect(setItem).toHaveBeenCalledWith('appfitness.height-unit', 'ft-in');
    expect(deleteItem).toHaveBeenCalledWith('appfitness.unit-system');
  });

  it('migrates metric to kg + cm and ignores values it does not know', async () => {
    stored({ 'appfitness.unit-system': 'metric', 'appfitness.weight-unit': 'stones' });
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ weight: 'kg', height: 'cm', status: 'ready' });
    expect(deleteItem).toHaveBeenCalledWith('appfitness.unit-system');
  });

  it('keeps kg and cm when the store cannot be read', async () => {
    getItem.mockRejectedValue(new Error('keystore locked'));
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ weight: 'kg', height: 'cm', status: 'ready' });
  });

  it('saves each choice apart and publishes it at once', async () => {
    await initializeUnits();
    await setWeightUnit('lb');
    expect(setItem).toHaveBeenCalledWith('appfitness.weight-unit', 'lb');
    expect(getUnitSnapshot()).toMatchObject({ weight: 'lb', height: 'cm' });
    await setHeightUnit('ft-in');
    expect(setItem).toHaveBeenCalledWith('appfitness.height-unit', 'ft-in');
    expect(getUnitSnapshot()).toMatchObject({ weight: 'lb', height: 'ft-in' });
  });
});

describe('UnitSelector (Perfil → Unidades)', () => {
  it('shows Peso and Estatura with their own dropdowns', async () => {
    await render(<UnitSelector />);
    await act(async () => {
      await initializeUnits();
    });
    expect(screen.getByTestId('unit-weight')).toHaveTextContent(/^kg/);
    expect(screen.getByTestId('unit-height')).toHaveTextContent(/^cm/);
    expect(screen.getByRole('button', { name: /(Unidad de peso|Weight unit): kg/ })).toBeTruthy();
  });

  it('opens the weight dropdown, picks lb and leaves the height in cm', async () => {
    await render(<UnitSelector />);
    await act(async () => {
      await initializeUnits();
    });

    await fireEvent.press(screen.getByTestId('unit-weight'));
    const lb = screen.getByTestId('unit-weight-option-lb');
    expect(screen.getByTestId('unit-weight-option-kg')).toBeSelected();
    expect(lb).not.toBeSelected();
    await fireEvent.press(lb);

    await waitFor(() => expect(screen.getByTestId('unit-weight')).toHaveTextContent(/^lb/));
    expect(screen.queryByTestId('unit-weight-sheet')).toBeNull();
    expect(screen.getByTestId('unit-height')).toHaveTextContent(/^cm/);
    expect(setItem).toHaveBeenCalledWith('appfitness.weight-unit', 'lb');
    expect(setItem).not.toHaveBeenCalledWith('appfitness.height-unit', expect.anything());
  });

  // v11-A item 3: the selected option is a solid pill in both themes.
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('marks the selected unit as a solid pill in %s mode', async (scheme, colors) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
    await render(<UnitSelector />);
    await act(async () => {
      await initializeUnits();
    });
    await fireEvent.press(screen.getByTestId('unit-height'));
    const flat = (unit: string) =>
      ReactNative.StyleSheet.flatten(screen.getByTestId(`unit-height-option-${unit}`).props.style);
    expect(flat('cm')).toEqual(
      expect.objectContaining({
        backgroundColor: colors.choiceSelectedFill,
        borderColor: colors.choiceSelectedFill,
        borderWidth: 2,
      }),
    );
    expect(flat('ft-in')).toEqual(
      expect.objectContaining({ backgroundColor: colors.glassFill, borderWidth: 1 }),
    );
  });

  it('says so when the choice cannot be saved', async () => {
    setItem.mockRejectedValueOnce(new Error('disk full'));
    await render(<UnitSelector />);

    await fireEvent.press(screen.getByTestId('unit-height'));
    await fireEvent.press(screen.getByTestId('unit-height-option-ft-in'));

    expect(await screen.findByText(/could not be saved|No se pudieron guardar/)).toBeOnTheScreen();
  });
});
