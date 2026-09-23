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
          /**
           * BUG-021. React Native defaults this to `"never"`, which lets the
           * first tap on a control be spent dismissing the open keyboard rather
           * than activating the control. On a form that means **Save has to be
           * tapped twice** after typing: once to close the keyboard, once to
           * submit. `"handled"` keeps the keyboard up only until a child
           * actually handles the touch, so the tap reaches the button while a
           * tap on empty space still dismisses as before.
           */
          keyboardShouldPersistTaps="handled"
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
