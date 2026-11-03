import { isIsoCountryCode } from '../domain/country';

/** The country picked on the sign-up form, for the account that picked it. */
export interface SignupCountry {
  userId: string;
  country: string;
}

export const SIGNUP_COUNTRY_STORAGE_KEY = 'appfitness.signup-country';

/** A stored value back into a SignupCountry; anything malformed reads as none. */
export function parseSignupCountry(raw: string | null): SignupCountry | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { userId, country } = parsed as Record<string, unknown>;
    return typeof userId === 'string' && userId.length > 0 && isIsoCountryCode(country)
      ? { userId, country }
      : null;
  } catch {
    return null;
  }
}
