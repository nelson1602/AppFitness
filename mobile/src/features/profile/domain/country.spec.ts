import { en } from '@/shared/localization/resources/en';
import { es } from '@/shared/localization/resources/es';

import { parseSignupCountry } from '../infrastructure/signup-country';
import { COUNTRY_LABEL_KEY } from '../presentation/country-label';
import {
  COUNTRY_CODES,
  countryFromRegion,
  DEFAULT_COUNTRY,
  isCountryCode,
  isIsoCountryCode,
  normalizeCountry,
  OTHER_COUNTRY,
} from './country';

describe('country (v8.1)', () => {
  it('lists the Dominican Republic first and "another country" last, with no duplicates', () => {
    expect(COUNTRY_CODES[0]).toBe('DO');
    expect(COUNTRY_CODES.at(-1)).toBe(OTHER_COUNTRY);
    expect(COUNTRY_CODES.slice(-3)).toEqual(['US', 'ES', 'ZZ']);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) expect(isIsoCountryCode(code)).toBe(true);
  });

  it('names every listed country in both languages', () => {
    for (const code of COUNTRY_CODES) {
      const key = COUNTRY_LABEL_KEY[code];
      expect(en[key]).toBeTruthy();
      expect(es[key]).toBeTruthy();
    }
    expect(es[COUNTRY_LABEL_KEY.DO]).toBe('República Dominicana');
    expect(en[COUNTRY_LABEL_KEY.ZZ]).toBe('Another country');
  });

  it.each([
    ['MX', 'MX'],
    ['mx', 'MX'],
    ['US', 'US'],
    ['ES', 'ES'],
    ['DO', 'DO'],
    // Not on the list → the owner's default, never "another country".
    ['FR', DEFAULT_COUNTRY],
    ['ZZ', DEFAULT_COUNTRY],
    [null, DEFAULT_COUNTRY],
    [undefined, DEFAULT_COUNTRY],
  ])('preselects %p from the device region as %p', (region, expected) => {
    expect(countryFromRegion(region)).toBe(expected);
  });

  it('keeps a valid stored code and reads anything else as DO', () => {
    expect(normalizeCountry('FR')).toBe('FR');
    expect(normalizeCountry('ZZ')).toBe('ZZ');
    for (const bad of ['do', 'DOM', '', null, undefined, 42]) {
      expect(normalizeCountry(bad)).toBe('DO');
    }
    expect(isCountryCode('FR')).toBe(false);
    expect(isCountryCode('PR')).toBe(true);
  });
});

describe('the stored sign-up country', () => {
  it('reads back what was stored', () => {
    expect(parseSignupCountry(JSON.stringify({ userId: 'u1', country: 'CO' }))).toEqual({
      userId: 'u1',
      country: 'CO',
    });
  });

  it.each([
    [null],
    [''],
    ['not json'],
    ['null'],
    [JSON.stringify({ userId: 'u1', country: 'co' })],
    [JSON.stringify({ userId: '', country: 'CO' })],
    [JSON.stringify({ country: 'CO' })],
  ])('reads %p as nothing stored', (raw) => {
    expect(parseSignupCountry(raw)).toBeNull();
  });
});
