import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';

type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'label' | 'caption';
type TextTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';

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

