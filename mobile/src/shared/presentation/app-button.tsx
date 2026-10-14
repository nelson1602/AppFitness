import { useRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';
import { usePaidWriteDisabled } from './paid-write-context';

/**
 * Mandatory minimum touch target (.ai/08_UI_UX.md — "Minimum touch target:
 * 44 x 44", WCAG 2.2 AA / Apple HIG). Enforced on every button, including the
 * bare `text` variant whose label alone would otherwise be well under 44px and
 * hard to hit (for users and automation alike).
 */
const MIN_TOUCH_TARGET = 44;

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: ViewStyle;
  /** The underlying `Pressable` host view (React 19 ref-as-prop). */
  ref?: Ref<View>;
}

export function AppButton({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  style,
  ref,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const paidWriteDisabled = usePaidWriteDisabled();
  const genuinelyDisabled = Boolean(disabled) || paidWriteDisabled;
  const isDisabled = genuinelyDisabled || loading;
  /**
   * BUG-035 (Web only, owner Option 1). react-native-web renders this as a
   * `<button>` and adds the native `disabled` attribute whenever it is disabled,
   * which drops keyboard focus to the page mid-request. While it is only
   * *loading*, the Web button therefore stays enabled and focused but inert:
   * every press handler is withheld, so click, Enter and Space do nothing, and
   * `aria-busy` is exposed instead of `disabled`/`aria-disabled`. Explicit and
   * paid-write disabling stay genuinely disabled.
   */
  const isWeb = Platform.OS === 'web';
  const webLoading = isWeb && loading && !genuinelyDisabled;
  /**
   * BUG-037 (Android, owner Option A). React Native maps a disabled state to
   * `View.setEnabled(false)`, and Android then moves focus off the focused button
   * to the first focusable view. While it is only *loading*, the Android button
   * therefore stays enabled, focused and busy, and every caller callback is
   * guarded instead of withheld: a touch that began while loading must not
   * become a press when the finger lifts after loading ends, because Pressability
   * completes a press with the handlers current at release.
   *
   * `pressBeganWhileLoading` is recomputed at every touch's `onPressIn`, which
   * Pressable always calls first. It is not cleared in `onPressOut`, which can run
   * before or after `onPress`. It is consulted only for a touch release; keyboard
   * and TalkBack activation reach `onPress` through a click with no touches and
   * no `onPressIn`, so a cancelled touch cannot block them. Any activation while
   * loading is refused. Explicit and paid-write disabling stay genuinely
   * disabled; iOS loading is unchanged.
   */
  const isAndroid = Platform.OS === 'android';
  const androidLoading = isAndroid && loading && !genuinelyDisabled;
  const pressBeganWhileLoading = useRef(false);
  const guardedPressIn = (event: GestureResponderEvent) => {
    pressBeganWhileLoading.current = androidLoading;
    if (!androidLoading) onPressIn?.(event);
  };
  const guardedPressOut = (event: GestureResponderEvent) => {
    if (!pressBeganWhileLoading.current) onPressOut?.(event);
  };
  const guardedLongPress = (event: GestureResponderEvent) => {
    if (!androidLoading && !pressBeganWhileLoading.current) onLongPress?.(event);
  };
  const guardedPress = (event: GestureResponderEvent) => {
    if (androidLoading) return;
    if (isTouchRelease(event) && pressBeganWhileLoading.current) return;
    onPress?.(event);
  };

  /**
   * BUG-020. While `loading` the visible label is replaced by a spinner, so a
   * button whose name came only from its child text became a **button with a
   * role and no name** exactly when it was busy (WCAG 4.1.2). Deriving the name
   * from string children keeps it stable across the swap, at no cost to callers
   * and with no new copy: the string is the label already on screen.
   *
   * An explicit `accessibilityLabel` always wins — several callers pass a
   * longer, more descriptive name than the visible text. Non-string children
   * (an element, a fragment) cannot be reduced to a name here without
   * inventing copy, so they are left to the caller.
   */
  const derivedLabel = typeof children === 'string' ? children : undefined;

  /**
   * The caller's state is merged, never replaced, so fields this component does
   * not own — `selected`, `expanded`, `checked` — survive. The two fields it
   * *does* own are applied last: `disabled` and `busy` describe the button's
   * actual interactivity, which `AppButton` alone computes, so a caller must
   * not be able to announce "not busy" while presses are being blocked.
   */
  const mergedAccessibilityState = {
    ...accessibilityState,
    disabled: webLoading || androidLoading ? false : isDisabled,
    busy: loading,
  };

  const variantStyle: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    secondary: {
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: theme.colors.outline,
    },
    text: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    destructive: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.error,
    },
  };

  /**
   * A filled variant's label is the `on*` foreground of the role it is filled
   * with: `onPrimary` on `primary`, `onError` on `error`. `destructive`
   * previously borrowed `onPrimary`, which happens to be `#FFFFFF` in the light
   * theme but is the dark theme's blue `#06345C` — a blue label on a red button
   * (ADR-P022 Addendum A).
   *
   * The unfilled variants map to `undefined` and the colour is then omitted
   * from the style **entirely**, never passed as `{ color: undefined }`.
   * `AppText` composes `[typography, { color: tone }, style]`, and a trailing
   * `{ color: undefined }` overwrites the tone when the array is flattened — so
   * `tone="primary"` never reached a `secondary` or `text` label, which
   * rendered React Native's default black instead: **1.23:1 on the dark
   * `surface` and 1.13:1 on the dark `background`** across every `text` button
   * in the app. Passing `undefined` for the whole style leaves the tone intact.
   */
  const labelColor: Record<ButtonVariant, string | undefined> = {
    primary: theme.colors.onPrimary,
    destructive: theme.colors.onError,
    secondary: undefined,
    text: undefined,
  };
  const textTone = variant === 'primary' || variant === 'destructive' ? 'default' : 'primary';

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? derivedLabel}
      accessibilityState={mergedAccessibilityState}
      aria-busy={isWeb && loading ? true : undefined}
      disabled={webLoading || androidLoading ? false : isDisabled}
      // Android guards every callback (BUG-037). Pressability cancels the press
      // after a long press whenever `onLongPress` is set, so that one (like
      // `onPress` and `onPressOut`) is passed only when the caller has it.
      // Web withholds them while loading (BUG-035).
      onLongPress={
        isAndroid ? onLongPress && guardedLongPress : webLoading ? undefined : onLongPress
      }
      onPress={isAndroid ? onPress && guardedPress : webLoading ? undefined : onPress}
      onPressIn={isAndroid ? guardedPressIn : webLoading ? undefined : onPressIn}
      onPressOut={isAndroid ? onPressOut && guardedPressOut : webLoading ? undefined : onPressOut}
      ref={ref}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radius.medium,
          minHeight: MIN_TOUCH_TARGET,
          minWidth: MIN_TOUCH_TARGET,
          paddingHorizontal: theme.spacing.lg,
          opacity: isDisabled ? 0.56 : pressed ? 0.84 : 1,
        },
        variantStyle[variant],
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant] ?? theme.colors.primary} />
      ) : (
        <AppText
          variant="label"
          tone={textTone}
          style={labelColor[variant] === undefined ? undefined : { color: labelColor[variant] }}
        >
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

/** A touch release carries its touches; a keyboard or accessibility click does not. */
function isTouchRelease(event: GestureResponderEvent): boolean {
  return Array.isArray(event?.nativeEvent?.changedTouches);
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
