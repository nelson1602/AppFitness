import { type ReactNode, useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';

import { Screen } from '@/shared/presentation';

/**
 * Web sign-in hero: never under 160 px, never over about 28% of the window
 * height, and never taller than the room the rest of the screen leaves, so the
 * whole sign-in fits a 1280×720 window. Below 160 px of room the screen scrolls
 * (short windows, phones), which is allowed.
 *
 * `otherContent` is the height of everything on the screen except the art
 * band itself (padding included); 0 while it is not measured yet.
 */
export const HERO_MIN_HEIGHT = 160;
export const HERO_MAX_VIEWPORT_SHARE = 0.28;

export function webHeroMaxHeight(windowHeight: number, otherContent = 0): number {
  const share = Math.round(windowHeight * HERO_MAX_VIEWPORT_SHARE);
  const room = otherContent > 0 ? windowHeight - otherContent : share;
  return Math.max(HERO_MIN_HEIGHT, Math.min(share, room));
}

/**
 * The window height on Web, or `null` on native and until it is known. It is
 * read after mount, not during render: the Web prerender has no window, and a
 * first client render that differs from the server HTML would keep the
 * server's styles after hydration.
 */
export function useWebWindowHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setHeight(Dimensions.get('window').height);
    update();
    const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, []);
  return height;
}

/** The auth column: the glass form's width, centred on wide windows. */
export const AUTH_COLUMN_MAX_WIDTH = 480;

/**
 * The shared frame of the auth screens (sign-in, forgot password, reset
 * password, verify email): the stage, scrolling as usual, with the content in
 * one centred column so nothing stretches across a desktop window.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <Screen stage style={styles.column}>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: {
    alignSelf: 'center',
    maxWidth: AUTH_COLUMN_MAX_WIDTH,
    width: '100%',
  },
});
