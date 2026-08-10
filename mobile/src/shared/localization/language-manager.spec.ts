import { applyLanguage, resolveCurrentLanguage } from './i18n';
import { getLanguageSnapshot, initializeLanguage, setLanguagePreference } from './language-manager';
import { loadLanguagePreference, saveLanguagePreference } from './language-storage';

jest.mock('./i18n', () => ({
  applyLanguage: jest.fn().mockResolvedValue(undefined),
  resolveCurrentLanguage: jest.fn((preference: string) =>
    preference === 'system' ? 'en' : preference,
  ),
}));
jest.mock('./language-storage', () => ({
  loadLanguagePreference: jest.fn(),
  saveLanguagePreference: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({ logError: jest.fn() }));

describe('language manager', () => {
  it('restores and applies the persisted language once', async () => {
    jest.mocked(loadLanguagePreference).mockResolvedValue('es');

    await initializeLanguage();

    expect(loadLanguagePreference).toHaveBeenCalledTimes(1);
    expect(applyLanguage).toHaveBeenCalledWith('es');
    expect(resolveCurrentLanguage).toHaveBeenCalledWith('es');
    expect(getLanguageSnapshot()).toEqual({ preference: 'es', language: 'es', status: 'ready' });
  });

  it('persists before publishing a new language preference', async () => {
    await setLanguagePreference('en');

    expect(saveLanguagePreference).toHaveBeenCalledWith('en');
    expect(applyLanguage).toHaveBeenCalledWith('en');
    expect(getLanguageSnapshot()).toEqual({ preference: 'en', language: 'en', status: 'ready' });
  });
});
