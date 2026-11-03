import { logError } from '@/shared/infrastructure/logging/logger';

import {
  parseSignupCountry,
  SIGNUP_COUNTRY_STORAGE_KEY,
  type SignupCountry,
} from './signup-country';

/**
 * Web variant (ADR-P018): `expo-secure-store` has no Web backend. Only the
 * non-sensitive sign-up country (a two-letter code and its account id) goes
 * to `localStorage`, best effort; failures are logged, never thrown.
 */

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (error) {
    logError('profile.signupCountry.web.unavailable', error);
    return null;
  }
}

export async function rememberSignupCountry(value: SignupCountry): Promise<void> {
  try {
    storage()?.setItem(SIGNUP_COUNTRY_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    logError('profile.signupCountry.web.save', error);
  }
}

export async function readSignupCountry(): Promise<SignupCountry | null> {
  try {
    return parseSignupCountry(storage()?.getItem(SIGNUP_COUNTRY_STORAGE_KEY) ?? null);
  } catch (error) {
    logError('profile.signupCountry.web.read', error);
    return null;
  }
}

export async function forgetSignupCountry(): Promise<void> {
  try {
    storage()?.removeItem(SIGNUP_COUNTRY_STORAGE_KEY);
  } catch (error) {
    logError('profile.signupCountry.web.clear', error);
  }
}
