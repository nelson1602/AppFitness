import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { useStageSurface } from './stage-surface';

type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'label' | 'caption';
/**
 * `onPrimary` is the label tone for text that sits ON a `primary` fill — the
 * filled CTA and every selected chip. It is not interchangeable with the other
 * tones: those are foregrounds for a surface ground, this one is only ever
 * correct on `primary`. It introduces no colour role — `onPrimary` is a shipped
 * token, and naming it here is what stopped four selected-chip call sites from
 * reaching for the default tone and rendering `onSurface` on `primary`
 * (1.42:1 in the dark theme — ADR-P022 Addendum A, `.ai/08_UI_UX.md` Finding 1).
 *
 * `onBrand` / `onBrandVariant` are likewise only correct on the identity
 * surface (`BrandHero`, ADR-P022 Addendum C), and are policed to it by
 * `color-usage.source.spec.ts`.
 *
 * `onStage`, `onStageVariant` and `linkOnStage` are the ADR-P035 foregrounds
 * for the stage and for glass on it; they are measured on every stage ground.
 */
type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'onPrimary'
  | 'onBrand'
  | 'onBrandVariant'
  | 'onStage'
  | 'onStageVariant'
  | 'linkOnStage'
  | 'success'
  | 'warning'
  | 'error'
  /** Inline errors on glass over the stage (ADR-P035, contrast-gated). */
  | 'errorOnStage';

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
  // On the stage the neutral tones resolve to their stage forms.
  const stage = useStageSurface();
  const resolvedTone: TextTone = stage
    ? tone === 'default'
      ? 'onStage'
      : tone === 'muted'
        ? 'onStageVariant'
        : tone === 'primary'
          ? 'linkOnStage'
          : tone === 'error'
            ? 'errorOnStage'
            : tone
    : tone;
  const colorByTone: Record<TextTone, string> = {
    default: theme.colors.onSurface,
    muted: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    onPrimary: theme.colors.onPrimary,
    onBrand: theme.colors.onBrand,
    onBrandVariant: theme.colors.onBrandVariant,
    onStage: theme.colors.onStage,
    onStageVariant: theme.colors.onStageVariant,
    linkOnStage: theme.colors.linkOnStage,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
    errorOnStage: theme.colors.errorOnStage,
  };

  return (
    <Text
      allowFontScaling
      style={[
        theme.typography[variant],
        {
          color: colorByTone[resolvedTone],
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
