import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';

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
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

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
    disabled: isDisabled,
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
      disabled={isDisabled}
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

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
});
