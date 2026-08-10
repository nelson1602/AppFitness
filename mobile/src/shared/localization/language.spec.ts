import { isLanguagePreference, resolveLanguage } from './language';

describe('language resolution', () => {
  it('honors an explicit supported preference', () => {
    expect(resolveLanguage('es', ['en'])).toBe('es');
    expect(resolveLanguage('en', ['es'])).toBe('en');
  });

  it('uses the first supported device language', () => {
    expect(resolveLanguage('system', ['fr', 'es-DO', 'en-US'])).toBe('es');
    expect(resolveLanguage('system', ['en-US', 'es-DO'])).toBe('en');
  });

  it('falls back to English for missing or unsupported device locales', () => {
    expect(resolveLanguage('system', [])).toBe('en');
    expect(resolveLanguage('system', [null, 'fr-FR'])).toBe('en');
  });

  it('accepts only supported persisted preference values', () => {
    expect(isLanguagePreference('system')).toBe(true);
    expect(isLanguagePreference('es')).toBe(true);
    expect(isLanguagePreference('en')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
    expect(isLanguagePreference(null)).toBe(false);
  });
});
