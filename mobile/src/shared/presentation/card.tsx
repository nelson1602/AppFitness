import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '../theme';
import { useStageSurface } from './stage-surface';

interface CardProps extends ViewProps {
  children: ReactNode;
}

export function Card({ children, style, ...props }: CardProps) {
  const theme = useTheme();
  // On the stage (StageSurfaceProvider) a card is the redesign's glass card.
  const glass = useStageSurface();
  return (
    <View
      style={[
        glass
          ? {
              backgroundColor: theme.colors.glassFill,
              borderColor: theme.colors.glassBorder,
              borderRadius: theme.radius.sheet,
              borderWidth: 1,
              padding: theme.spacing.lg,
            }
          : {
              backgroundColor: theme.dark ? theme.colors.surfaceVariant : theme.colors.surface,
              borderColor: theme.colors.divider,
              borderRadius: theme.radius.large,
              borderWidth: 1,
              padding: theme.spacing.lg,
              ...(theme.dark ? theme.elevations.level0 : theme.elevations.level1),
            },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
