import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '@/app/_layout';
import { startAppConfigWatch } from '@/features/app-config';

let mockUpdateRequired = false;

function mockStub(label: string) {
  function Stub() {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{label}</Text>;
  }
  return Stub;
}

jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: ReactNode }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <>
        <Text>Navigator</Text>
        {children}
      </>
    );
  };
  Stack.Screen = function StackScreen() {
    return null;
  };
  return {
    DarkTheme: { colors: {} },
    DefaultTheme: { colors: {} },
    Stack,
    ThemeProvider: ({ children }: { children: ReactNode }) => children,
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('@/features/app-config', () => ({
  startAppConfigWatch: jest.fn(),
  useUpdateRequired: () => mockUpdateRequired,
  UpdateRequiredScreen: mockStub('Update required screen'),
}));
jest.mock('@/features/authentication/presentation/access-gate-redirect', () => ({
  AccessGateRedirect: mockStub('Access gate'),
}));
jest.mock('@/features/evaluation/presentation/evaluation-gate-redirect', () => ({
  EvaluationGateRedirect: mockStub('Evaluation gate'),
}));
jest.mock('@/features/dashboard/application/use-home-data', () => ({
  registerDayRollover: jest.fn(),
}));
jest.mock('@/features/nutrition', () => ({ registerNutritionSyncAppliers: jest.fn() }));
jest.mock('@/features/progress', () => ({ registerProgressSyncAppliers: jest.fn() }));
jest.mock('@/features/subscriptions', () => ({
  initializeSubscriptionAccessEnforcement: jest.fn(),
  initializeSubscriptionPurchases: jest.fn(),
}));
jest.mock('@/features/weekly-plan/infrastructure/sync-appliers', () => ({
  registerWeeklyPlanSyncAppliers: jest.fn(),
}));
jest.mock('@/features/wellness', () => ({ registerWellnessSyncAppliers: jest.fn() }));
jest.mock('@/features/profile', () => ({ registerProfileSyncAppliers: jest.fn() }));
jest.mock('@/features/shell/application/welcome-gate', () => ({
  initializeWelcomeGate: jest.fn(),
}));
jest.mock('@/features/workout', () => ({ registerWorkoutSyncAppliers: jest.fn() }));
jest.mock('@/shared/application/local-day', () => ({ startLocalDayWatch: jest.fn() }));
jest.mock('@/shared/infrastructure/monitoring/sentry', () => ({ initMonitoring: jest.fn() }));
jest.mock('@/shared/localization', () => ({
  DocumentHead: () => null,
  useLocalization: () => ({ language: 'en', t: (key: string) => key }),
}));
jest.mock('@/shared/theme', () => ({
  holdSplashForBrandFonts: jest.fn(),
  useBrandFonts: () => true,
  useTheme: () => ({
    dark: true,
    colors: {
      primary: 'p',
      background: 'b',
      surface: 's',
      onSurface: 'o',
      divider: 'd',
      onStage: 'os',
      stage: 'st',
    },
  }),
}));

describe('RootLayout — update required (ADR-P049 amendment 1)', () => {
  beforeEach(() => {
    mockUpdateRequired = false;
  });

  it('starts the app config watch at load', () => {
    expect(startAppConfigWatch).toHaveBeenCalledTimes(1);
  });

  it('renders the navigator and its gates while no update is required', async () => {
    await render(<RootLayout />);
    expect(screen.getByText('Navigator')).toBeOnTheScreen();
    expect(screen.getByText('Access gate')).toBeOnTheScreen();
    expect(screen.getByText('Evaluation gate')).toBeOnTheScreen();
    expect(screen.queryByText('Update required screen')).toBeNull();
  });

  it('covers the app with the update screen, keeping the navigator mounted but hidden', async () => {
    mockUpdateRequired = true;
    await render(<RootLayout />);
    expect(screen.getByText('Update required screen')).toBeOnTheScreen();
    expect(screen.getByTestId('update-required-overlay')).toBeOnTheScreen();
    // Expo Router needs its navigator mounted for any router call; it is
    // hidden from touch and from screen readers instead.
    const navigator = screen.getByTestId('root-navigator', {
      includeHiddenElements: true,
    });
    expect(navigator.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(navigator.props.accessibilityElementsHidden).toBe(true);
    expect(navigator.props.pointerEvents).toBe('none');
    expect(screen.queryByText('Navigator')).toBeNull();
    expect(screen.getByText('Navigator', { includeHiddenElements: true })).toBeTruthy();
  });
});
