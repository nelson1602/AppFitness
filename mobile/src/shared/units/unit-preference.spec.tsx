import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import {
  getUnitSnapshot,
  initializeUnits,
  resetUnitsForTests,
  setUnitSystem,
} from './unit-manager';
import { UnitSelector } from './unit-selector';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

const getItem = jest.mocked(SecureStore.getItemAsync);
const setItem = jest.mocked(SecureStore.setItemAsync);

beforeEach(() => {
  jest.clearAllMocks();
  resetUnitsForTests();
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue();
});

describe('unit preference (v10 Block C, item 9)', () => {
  it('starts in metric, as before, when nothing is stored', async () => {
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ system: 'metric', status: 'ready' });
  });

  it('loads a stored imperial choice and ignores anything else', async () => {
    getItem.mockResolvedValueOnce('imperial');
    await initializeUnits();
    expect(getUnitSnapshot().system).toBe('imperial');

    resetUnitsForTests();
    getItem.mockResolvedValueOnce('stones');
    await initializeUnits();
    expect(getUnitSnapshot().system).toBe('metric');
  });

  it('keeps metric when the store cannot be read', async () => {
    getItem.mockRejectedValueOnce(new Error('keystore locked'));
    await initializeUnits();
    expect(getUnitSnapshot()).toEqual({ system: 'metric', status: 'ready' });
  });

  it('saves a new choice and publishes it at once', async () => {
    await setUnitSystem('imperial');
    expect(setItem).toHaveBeenCalledWith('appfitness.unit-system', 'imperial');
    expect(getUnitSnapshot().system).toBe('imperial');
  });
});

describe('UnitSelector (Perfil → Unidades)', () => {
  it('offers kg / cm and lb / ft-in as radios and switches on press', async () => {
    await render(<UnitSelector />);
    await act(async () => {
      await initializeUnits();
    });

    const metric = screen.getByRole('radio', { name: /kg \/ cm/ });
    const imperial = screen.getByRole('radio', { name: /lb \/ ft-in/ });
    expect(metric).toBeSelected();
    expect(imperial).not.toBeSelected();

    await fireEvent.press(imperial);

    await waitFor(() => expect(screen.getByRole('radio', { name: /lb \/ ft-in/ })).toBeSelected());
    expect(setItem).toHaveBeenCalledWith('appfitness.unit-system', 'imperial');
  });

  it('says so when the choice cannot be saved', async () => {
    setItem.mockRejectedValueOnce(new Error('disk full'));
    await render(<UnitSelector />);

    await fireEvent.press(screen.getByRole('radio', { name: /lb \/ ft-in/ }));

    expect(await screen.findByText(/could not be saved|No se pudieron guardar/)).toBeOnTheScreen();
  });
});
