import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logError } from '@/shared/infrastructure/logging/logger';

import { FONT_ASSETS } from './fonts';

/**
 * Native only: keep the splash screen up until the brand faces are ready, so
 * no screen ever paints in the platform face and then jumps (ADR-P037). Called
 * once at module load by the root layout.
 */
export function holdSplashForBrandFonts(): void {
  if (Platform.OS === 'web') return;
  SplashScreen.preventAutoHideAsync().catch((error: unknown) =>
    logError('theme.fonts.preventAutoHide', error),
  );
}

/**
 * Loads Sora and Inter and reports whether the app may render.
 *
 * - Native: `false` until the faces load or fail, then the splash is released.
 *   A load failure is logged and the app continues in the platform face rather
 *   than staying on the splash forever.
 * - Web: always `true`. The statically prerendered document must contain the
 *   real screen (ADR-P032), and the Web type stack falls back to system fonts
 *   while the faces load.
 */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(FONT_ASSETS);
  const settled = loaded || error !== null;

  useEffect(() => {
    if (error) logError('theme.fonts.load', error);
  }, [error]);

  useEffect(() => {
    if (!settled || Platform.OS === 'web') return;
    SplashScreen.hideAsync().catch((hideError: unknown) =>
      logError('theme.fonts.hideSplash', hideError),
    );
  }, [settled]);

  return Platform.OS === 'web' || settled;
}
