import { formatDate, formatNumber, localeForLanguage } from './format';

describe('localized formatting foundation', () => {
  it('maps supported languages to stable presentation locales', () => {
    expect(localeForLanguage('en')).toBe('en-US');
    expect(localeForLanguage('es')).toBe('es');
  });

  it('formats decimal values using the selected language', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'es')).toBe('1234,5');
  });

  it('formats dates without changing the underlying instant', () => {
    const instant = Date.UTC(2026, 0, 15, 12);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    };

    const english = formatDate(instant, 'en', options);
    const spanish = formatDate(instant, 'es', options);

    expect(english).toContain('2026');
    expect(spanish).toContain('2026');
    expect(spanish).not.toBe(english);
  });
});
