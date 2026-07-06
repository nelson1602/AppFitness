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
  style,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

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

  const textTone = variant === 'primary' || variant === 'destructive' ? 'default' : 'primary';

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: theme.radius.medium,
          minHeight: theme.spacing.xl + theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          opacity: isDisabled ? 0.56 : pressed ? 0.84 : 1,
        },
        variantStyle[variant],
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'destructive'
              ? theme.colors.onPrimary
              : theme.colors.primary
          }
        />
      ) : (
        <AppText
          variant="label"
          tone={textTone}
          style={{
            color:
              variant === 'primary' || variant === 'destructive'
                ? theme.colors.onPrimary
                : undefined,
          }}
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
