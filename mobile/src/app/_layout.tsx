import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AccessGateRedirect } from '@/features/authentication/presentation/access-gate-redirect';
import { registerNutritionSyncAppliers } from '@/features/nutrition';
import { registerProgressSyncAppliers } from '@/features/progress';
import {
  initializeSubscriptionAccessEnforcement,
  initializeSubscriptionPurchases,
} from '@/features/subscriptions';
import { registerWeeklyPlanSyncAppliers } from '@/features/weekly-plan/infrastructure/sync-appliers';
import { registerWellnessSyncAppliers } from '@/features/wellness';
import { registerProfileSyncAppliers } from '@/features/profile';
import { initializeWelcomeGate } from '@/features/shell/application/welcome-gate';
import { registerWorkoutSyncAppliers } from '@/features/workout';
import { initMonitoring } from '@/shared/infrastructure/monitoring/sentry';
import { DocumentHead, useLocalization } from '@/shared/localization';
import { holdSplashForBrandFonts, useBrandFonts, useTheme } from '@/shared/theme';

// Composition root: features register their sync appliers once at app
// load. The sync worker itself runs on demand (no scheduling yet).
// Monitoring is a no-op unless the build injects a Sentry DSN
// (ADR-P010) — dev, tests, and E2E builds run without it.
initMonitoring();
initializeSubscriptionPurchases();
initializeSubscriptionAccessEnforcement();
registerProfileSyncAppliers();
registerNutritionSyncAppliers();
registerWorkoutSyncAppliers();
registerProgressSyncAppliers();
registerWellnessSyncAppliers();
registerWeeklyPlanSyncAppliers();
// The welcome screen is owed once after each sign-in (ADR-P039 D5).
initializeWelcomeGate();
// Native: no screen paints before the brand faces are ready (ADR-P037).
holdSplashForBrandFonts();

export default function RootLayout() {
  const theme = useTheme();
  useLocalization();
  const fontsReady = useBrandFonts();

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

  // The splash is still up on native until the faces settle (see useBrandFonts).
  if (!fontsReady) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Web document title and lang (BUG-016, ADR-P032). Renders null on
          native, where Stack.Screen options.title remains the only mechanism. */}
      <DocumentHead />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {/* The tab shell and the welcome screen draw their own headers (ADR-P039). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="verify-pending" options={{ headerShown: false }} />
      </Stack>
      {/* Mandatory email verification (ADR-P041): no data route stays open
          for an account that still owes a step. */}
      <AccessGateRedirect />
    </ThemeProvider>
  );
}
