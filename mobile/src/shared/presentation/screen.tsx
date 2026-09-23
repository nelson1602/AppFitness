import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}

/**
 * A reported keyboard height is only usable as clearance when it is a finite,
 * positive number; anything else means no clearance. Rounding up keeps the last
 * sub-point of the action clear and stops sub-pixel reports counting as a change.
 */
function toClearance(height: number | undefined): number {
  return height !== undefined && Number.isFinite(height) && height > 0 ? Math.ceil(height) : 0;
}

/**
 * BUG-022. On Android the window no longer resizes for the keyboard
 * (edge-to-edge is mandatory from Expo SDK 57), so the keyboard covers the
 * bottom of the scroll view and the last content — typically Save — can never be
 * scrolled above it. While the keyboard is shown, this returns its height so the
 * scroll content can be extended by exactly that much; it returns 0 otherwise,
 * off Android, and for the non-scroll form. State changes only when the
 * effective clearance changes.
 */
function useAndroidKeyboardClearance(enabled: boolean): number {
  const [clearance, setClearance] = useState(0);
  const clearanceRef = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;

    const apply = (height: number | undefined) => {
      const next = toClearance(height);
      if (next === clearanceRef.current) return;
      clearanceRef.current = next;
      setClearance(next);
    };

    // A screen can mount while the keyboard is already open.
    apply(Keyboard.isVisible() ? Keyboard.metrics()?.height : 0);

    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      apply(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => apply(0));

    return () => {
      shown.remove();
      hidden.remove();
      apply(0);
    };
  }, [enabled]);

  return clearance;
}

export function Screen({ children, scroll = true, style }: ScreenProps) {
  const theme = useTheme();
  const keyboardClearance = useAndroidKeyboardClearance(scroll);
  const contentStyle: ViewStyle = {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[contentStyle, style]}
          /**
           * BUG-021. React Native defaults this to `"never"`, which lets the
           * first tap on a control be spent dismissing the open keyboard rather
           * than activating the control. On a form that means **Save has to be
           * tapped twice** after typing: once to close the keyboard, once to
           * submit. `"handled"` keeps the keyboard up only until a child
           * actually handles the touch, so the tap reaches the button while a
           * tap on empty space still dismisses as before.
           */
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: theme.colors.background }}
        >
          {children}
          {keyboardClearance > 0 ? (
            // Empty scroll room only: hidden from assistive technology and
            // transparent to touches, so a tap on it reaches the ScrollView and
            // dismisses the keyboard like any other empty space.
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={{ height: keyboardClearance }}
            />
          ) : null}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, backgroundColor: theme.colors.background }, contentStyle, style]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
