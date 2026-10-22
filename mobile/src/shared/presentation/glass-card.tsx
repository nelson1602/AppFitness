import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '../theme';

interface GlassCardProps extends ViewProps {
  children: ReactNode;
}

/**
 * Translucent glass card for the stage (ADR-P035 D4): a `glassFill` with a
 * `glassBorder` hairline and no blur, so legibility never depends on a blur
 * effect. Every foreground used on it is measured composited over each stage
 * ground (`contrast.spec.ts`). Passive, like `Card`; the caller's `style` wins.
 */
export function GlassCard({ children, style, ...props }: GlassCardProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.glassFill,
          borderColor: colors.glassBorder,
          borderRadius: radius.sheet,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.xl,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
