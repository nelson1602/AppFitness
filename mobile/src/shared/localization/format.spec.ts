import { formatDate, formatNumber, interpolate, localeForLanguage } from './format';

describe('localized formatting foundation', () => {
  it('maps supported languages to stable presentation locales', () => {
    expect(localeForLanguage('en')).toBe('en-US');
    expect(localeForLanguage('es')).toBe('es');
  });

  it('formats decimal values using the selected language', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'es')).toBe('1234,5');
  });

  it('groups thousands per language', () => {
    // `en-US` groups a four-digit number and generic `es` does not. Two shipped
    // surfaces rendered the same calorie target on either side of that line.
    expect(formatNumber(2500, 'en')).toBe('2,500');
    expect(formatNumber(2500, 'es')).toBe('2500');
  });

  it('drops trailing zeros from a fractional value', () => {
    // What `formatServingCount` relies on instead of its own integer check.
    expect(formatNumber(1, 'es', { maximumFractionDigits: 2 })).toBe('1');
    expect(formatNumber(1.5, 'es', { maximumFractionDigits: 2 })).toBe('1,5');
    expect(formatNumber(0.25, 'es', { maximumFractionDigits: 2 })).toBe('0,25');
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

describe('catalogue interpolation', () => {
  it('substitutes every occurrence of a token', () => {
    expect(interpolate('{a} of {b}, {a} left', { a: '2', b: '3' })).toBe('2 of 3, 2 left');
  });

  it('leaves a value with no token untouched', () => {
    expect(interpolate('Sign in', { count: '1' })).toBe('Sign in');
  });

  it('places text and never formats it', () => {
    // The contract callers depend on: numbers are localized by `formatNumber`
    // before they get here, so this must not stringify one itself.
    expect(interpolate('After {count} successful sessions', { count: formatNumber(2, 'es') })).toBe(
      'After 2 successful sessions',
    );
  });
});
