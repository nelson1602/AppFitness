import * as SecureStore from 'expo-secure-store';

import { loadLanguagePreference, saveLanguagePreference } from './language-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('language preference storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads a supported persisted preference', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('es');

    await expect(loadLanguagePreference()).resolves.toBe('es');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('appfitness.language-preference');
  });

  it('falls back to the device preference for missing or invalid storage', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null).mockResolvedValueOnce('fr');

    await expect(loadLanguagePreference()).resolves.toBe('system');
    await expect(loadLanguagePreference()).resolves.toBe('system');
  });

  it('persists an explicit language without storing user content', async () => {
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue();

    await saveLanguagePreference('en');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('appfitness.language-preference', 'en');
  });
});
