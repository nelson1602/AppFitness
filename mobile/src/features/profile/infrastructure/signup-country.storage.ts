import * as SecureStore from 'expo-secure-store';

import { logError } from '@/shared/infrastructure/logging/logger';

import {
  parseSignupCountry,
  SIGNUP_COUNTRY_STORAGE_KEY,
  type SignupCountry,
} from './signup-country';

/**
 * v8.1 — the country chosen on the sign-up form, kept on the device until the
 * account's profile is first created (the evaluation). Non-sensitive: a
 * two-letter country code and the account id it belongs to, nothing else.
 * Storage failures never block sign-up or the profile save; they are logged
 * and the profile falls back to the default country.
 */

export async function rememberSignupCountry(value: SignupCountry): Promise<void> {
  try {
    await SecureStore.setItemAsync(SIGNUP_COUNTRY_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    logError('profile.signupCountry.save', error);
  }
}

export async function readSignupCountry(): Promise<SignupCountry | null> {
  try {
    return parseSignupCountry(await SecureStore.getItemAsync(SIGNUP_COUNTRY_STORAGE_KEY));
  } catch (error) {
    logError('profile.signupCountry.read', error);
    return null;
  }
}

export async function forgetSignupCountry(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SIGNUP_COUNTRY_STORAGE_KEY);
  } catch (error) {
    logError('profile.signupCountry.clear', error);
  }
}
