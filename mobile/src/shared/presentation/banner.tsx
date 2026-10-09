import { useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';

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
  const isAndroid = Platform.OS === 'android';
  // BUG-034: Android announces a live region only when an attached view's text
  // changes. So on Android every Banner carries one persistent, zero-size
  // announcement text: empty until the root is first laid out, then the error
  // while the tone is `error`, and empty again otherwise. The visible title and
  // body render synchronously and are not live regions.
  const [laidOut, setLaidOut] = useState(false);
  const body = typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  const announcement = laidOut && tone === 'error' ? (body ? `${title}. ${body}` : title) : '';

  return (
    <View
      accessibilityRole="summary"
      // BUG-025 / ADR-P024 bounded extension: only the error tone requests a
      // polite announcement, on this existing root, for react-native-web. On
      // Android a live region on this root composes no speech (BUG-034), so the
      // announcement text below carries it instead. iOS is not covered. Other
      // tones stay passive and carry no live-region prop.
      aria-live={tone === 'error' && !isAndroid ? 'polite' : undefined}
      onLayout={isAndroid && !laidOut ? () => setLaidOut(true) : undefined}
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
      {isAndroid ? (
        // Absolutely positioned and zero-size: outside layout and `gap`, and not
        // visible to the user, so it adds no TalkBack or keyboard stop.
        <Text
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
          testID="banner-announcement"
        >
          {announcement}
        </Text>
      ) : null}
    </View>
  );
}
