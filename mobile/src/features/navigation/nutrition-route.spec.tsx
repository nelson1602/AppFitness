import { render, screen } from '@testing-library/react-native';

import NutritionRoute from '@/app/nutrition';

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

jest.mock('@/features/nutrition/presentation/NutritionTargets', () => ({
  NutritionTargets: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Nutrition targets content</Text>;
  },
}));

describe('NutritionRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<NutritionRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<NutritionRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders nutrition targets for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<NutritionRoute />);
    expect(screen.getByText('Nutrition targets content')).toBeOnTheScreen();
  });
});
