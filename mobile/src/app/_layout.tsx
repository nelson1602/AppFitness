import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { registerMedicalSyncAppliers } from '@/features/medical';
import { registerProfileSyncAppliers } from '@/features/profile';
import { useTheme } from '@/shared/theme';

// Composition root: features register their sync appliers once at app
// load. The sync worker itself runs on demand (no scheduling yet).
registerProfileSyncAppliers();
registerMedicalSyncAppliers();

export default function RootLayout() {
  const theme = useTheme();

  // Bridge our design tokens into the navigation container so native
  // navigation surfaces (headers, backgrounds) match the app theme.
  const navigationTheme = {
    ...(theme.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.divider,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </ThemeProvider>
  );
}
