import { View } from 'react-native';

import { Card } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

export function DashboardSkeleton() {
  const theme = useTheme();
  return (
    <>
      {[0, 1, 2].map((item) => (
        <Card key={item} accessibilityLabel="Loading dashboard section">
          <View
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: theme.radius.medium,
              height: theme.spacing.xxl,
              marginBottom: theme.spacing.md,
              width: '54%',
            }}
          />
          <View
            style={{
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: theme.radius.medium,
              height: theme.spacing.lg,
              width: '86%',
            }}
          />
        </Card>
      ))}
    </>
  );
}
