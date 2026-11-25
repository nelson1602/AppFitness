import * as Application from 'expo-application';
import { Linking } from 'react-native';

import { logWarn } from '@/shared/infrastructure/logging';

/** The Android package (app.json `android.package`), used if the native module has none. */
export const ANDROID_PACKAGE_FALLBACK = 'com.appfitnessrd.mobile';

/**
 * Pure: the native build version as a versionCode — a positive integer written
 * only with digits — or null for anything else (absent, '', 'abc', '0', '1.2').
 */
export function parseVersionCode(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return null;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * The installed build's versionCode on Android (`nativeBuildVersion` is the
 * versionCode as a string there), or null when it cannot be read. Callers fail
 * open on null.
 */
export function readInstalledVersionCode(): number | null {
  return parseVersionCode(Application.nativeBuildVersion);
}

/**
 * Opens this app's Google Play listing: the Play Store app first (`market://`),
 * then the web listing when no app handles that link. Never throws.
 */
export async function openStoreListing(): Promise<void> {
  const id = Application.applicationId ?? ANDROID_PACKAGE_FALLBACK;
  try {
    await Linking.openURL(`market://details?id=${id}`);
  } catch {
    try {
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${id}`);
    } catch (error) {
      logWarn('appConfig.storeListing', error instanceof Error ? error.name : 'unknown failure');
    }
  }
}
