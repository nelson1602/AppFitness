import { getLocales } from 'expo-localization';

import { logError } from '@/shared/infrastructure/logging/logger';

import { countryFromRegion, DEFAULT_COUNTRY, type CountryCode } from '../domain/country';

/**
 * v8.1 — the sign-up form's preselected country: the device's region when the
 * picker lists it, otherwise the Dominican Republic (owner decision).
 */
export function deviceDefaultCountry(): CountryCode {
  try {
    return countryFromRegion(getLocales()[0]?.regionCode);
  } catch (error) {
    logError('profile.deviceCountry', error);
    return DEFAULT_COUNTRY;
  }
}
