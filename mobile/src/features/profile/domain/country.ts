/**
 * The person's country (v8.1). Stored as an ISO 3166-1 alpha-2 code on the
 * synced profile; the meal plan reads it to choose between the Dominican dish
 * catalogue ('DO') and the generic food-based plan (anything else).
 *
 * The picker offers a curated list — the Dominican Republic first, the other
 * Spanish-speaking countries of the Americas, the United States and Spain —
 * and 'ZZ' (ISO user-assigned) for any other country. Pure: no I/O.
 */

/** The owner's default for new and existing profiles. */
export const DEFAULT_COUNTRY = 'DO';

/** "Otro país": an ISO user-assigned code, so it still passes the two-letter rule. */
export const OTHER_COUNTRY = 'ZZ';

/** The curated picker list, in display order. */
export const COUNTRY_CODES = [
  'DO',
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'EC',
  'SV',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PY',
  'PE',
  'PR',
  'UY',
  'VE',
  'US',
  'ES',
  'ZZ',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/** Mirrors the API rule and both databases' CHECK: two uppercase ASCII letters. */
const ISO_ALPHA2 = /^[A-Z]{2}$/;

export function isIsoCountryCode(value: unknown): value is string {
  return typeof value === 'string' && ISO_ALPHA2.test(value);
}

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && (COUNTRY_CODES as readonly string[]).includes(value);
}

/**
 * The picker's preselection: the device's region when the list has it,
 * otherwise the Dominican Republic. A region the list lacks is NOT mapped to
 * "Otro país" — the owner's default is DO.
 */
export function countryFromRegion(regionCode: string | null | undefined): CountryCode {
  const region = regionCode?.toUpperCase() ?? null;
  return region !== null && region !== OTHER_COUNTRY && isCountryCode(region)
    ? region
    : DEFAULT_COUNTRY;
}

/**
 * A stored or pulled value as the app reads it: a valid code is kept as it is
 * (even one outside the curated list, set by another client), anything else
 * reads as the default.
 */
export function normalizeCountry(value: unknown): string {
  return isIsoCountryCode(value) ? value : DEFAULT_COUNTRY;
}
