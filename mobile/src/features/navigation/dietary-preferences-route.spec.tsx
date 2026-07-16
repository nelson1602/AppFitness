import { render, screen } from '@testing-library/react-native';

import DietaryPreferencesRoute from '@/app/dietary-preferences';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: { Screen: () => null },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));

jest.mock('@/features/nutrition/presentation/DietaryPreferences', () => ({
  DietaryPreferences: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Dietary preferences content</Text>;
  },
}));

describe('DietaryPreferencesRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<DietaryPreferencesRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<DietaryPreferencesRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders dietary preferences management for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<DietaryPreferencesRoute />);
    expect(screen.getByText('Dietary preferences content')).toBeOnTheScreen();
  });
});
