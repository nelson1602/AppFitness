import { useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';
import { useStageSurface } from './stage-surface';

type BannerTone = 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  title: string;
  children?: ReactNode;
  tone?: BannerTone;
}

export function Banner({ title, children, tone = 'info' }: BannerProps) {
  const theme = useTheme();
  const stage = useStageSurface();
  const toneColor: Record<BannerTone, string> = {
    info: theme.colors.info,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };
  const titleTone = tone === 'info' ? 'primary' : tone;
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';
  // BUG-034 (Android) and BUG-038 (Web): a live region is announced only when
  // an existing region's text changes, never when it is inserted already
  // holding text. So on Android and Web every Banner carries one persistent,
  // zero-size announcement text: empty until the root is first laid out, then
  // the error while the tone is `error`, and empty again otherwise. The visible
  // title and body render synchronously and are not live regions. On Web, while
  // the tone is `error`, whatever the announcement text carries is hidden from
  // assistive technology, so browse mode meets the error once. A body made of
  // several text pieces is carried whole there; a body holding elements is not
  // carried, and so stays exposed.
  const announces = isAndroid || isWeb;
  const [laidOut, setLaidOut] = useState(false);
  const body = isWeb
    ? plainText(children)
    : typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : '';
  const announcement = laidOut && tone === 'error' ? (body ? `${title}. ${body}` : title) : '';
  const hideTitle = isWeb && tone === 'error' ? true : undefined;
  const hideBody = hideTitle && body !== null ? true : undefined;

  return (
    <View
      accessibilityRole="summary"
      // BUG-025 / ADR-P024 bounded extension: only the error tone requests a
      // polite announcement. On Android and Web the announcement text below
      // carries it (BUG-034, BUG-038), so this root is not a live region there. iOS
      // keeps the root request unchanged; it is not covered. Other tones carry
      // no live-region prop.
      aria-live={tone === 'error' && !announces ? 'polite' : undefined}
      onLayout={announces && !laidOut ? () => setLaidOut(true) : undefined}
      style={{
        // v8 Block 3: on the stage the banner is glass and keeps its tone edge.
        backgroundColor: stage ? theme.colors.glassFill : theme.colors.surfaceVariant,
        // Off the stage the tone colours the whole (left-only) border as before.
        borderColor: stage ? theme.colors.glassBorder : toneColor[tone],
        ...(stage ? { borderLeftColor: toneColor[tone], borderWidth: 1 } : undefined),
        borderLeftWidth: theme.spacing.xs,
        borderRadius: theme.radius.medium,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
      }}
    >
      <AppText aria-hidden={hideTitle} variant="label" tone={titleTone}>
        {title}
      </AppText>
      {children ? (
        <AppText aria-hidden={hideBody} variant="caption" tone="muted">
          {children}
        </AppText>
      ) : null}
      {announces ? (
        // Absolutely positioned and zero-size: outside layout and `gap`, and not
        // visible to the user, so it adds no TalkBack or keyboard stop.
        // react-native-web maps `aria-live` to the DOM; Android uses the native
        // live region, since `Text` does not map `aria-live` there.
        <Text
          accessibilityLiveRegion={isAndroid ? 'polite' : undefined}
          aria-live={isWeb ? 'polite' : undefined}
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
          testID="banner-announcement"
        >
          {announcement}
        </Text>
      ) : null}
    </View>
  );
}

// The text of a body made only of strings and numbers (for example
// `{name} {t('…')}`), or null when it holds an element.
function plainText(node: ReactNode): string | null {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (!Array.isArray(node)) return null;
  let text = '';
  for (const part of node as ReactNode[]) {
    const piece = plainText(part);
    if (piece === null) return null;
    text += piece;
  }
  return text;
}
