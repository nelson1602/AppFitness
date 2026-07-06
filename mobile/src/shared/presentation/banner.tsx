import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';

type BannerTone = 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  title: string;
  children?: ReactNode;
  tone?: BannerTone;
}

export function Banner({ title, children, tone = 'info' }: BannerProps) {
  const theme = useTheme();
  const toneColor: Record<BannerTone, string> = {
    info: theme.colors.info,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };
  const titleTone = tone === 'info' ? 'primary' : tone;

  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: theme.colors.surfaceVariant,
        borderColor: toneColor[tone],
        borderLeftWidth: theme.spacing.xs,
        borderRadius: theme.radius.medium,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
      }}
    >
      <AppText variant="label" tone={titleTone}>
        {title}
      </AppText>
      {children ? (
        <AppText variant="caption" tone="muted">
          {children}
        </AppText>
      ) : null}
    </View>
  );
}
