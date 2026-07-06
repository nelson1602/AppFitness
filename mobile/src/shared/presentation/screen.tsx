import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scroll = true, style }: ScreenProps) {
  const theme = useTheme();
  const contentStyle: ViewStyle = {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[contentStyle, style]}
          style={{ backgroundColor: theme.colors.background }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, backgroundColor: theme.colors.background }, contentStyle, style]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

