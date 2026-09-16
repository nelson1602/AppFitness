import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';

type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'label' | 'caption';
/**
 * `onPrimary` is the label tone for text that sits ON a `primary` fill — the
 * filled CTA and every selected chip. It is not interchangeable with the other
 * tones: those are foregrounds for a surface ground, this one is only ever
 * correct on `primary`. It introduces no colour role — `onPrimary` is a shipped
 * token, and naming it here is what stopped four selected-chip call sites from
 * reaching for the default tone and rendering `onSurface` on `primary`
 * (1.42:1 in the dark theme — ADR-P022 Addendum A, `.ai/08_UI_UX.md` Finding 1).
 */
type TextTone = 'default' | 'muted' | 'primary' | 'onPrimary' | 'success' | 'warning' | 'error';

interface AppTextProps extends TextProps {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

export function AppText({
  children,
  variant = 'body',
  tone = 'default',
  align,
  style,
  ...props
}: AppTextProps) {
  const theme = useTheme();
  const colorByTone: Record<TextTone, string> = {
    default: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    onPrimary: theme.colors.onPrimary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };

  return (
    <Text
      allowFontScaling
      style={[
        theme.typography[variant],
        {
          color: colorByTone[tone],
          textAlign: align,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
