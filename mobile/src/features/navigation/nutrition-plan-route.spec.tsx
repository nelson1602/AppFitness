import { render, screen } from '@testing-library/react-native';

import NutritionPlanRoute from '@/app/nutrition-plan';

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

jest.mock('@/features/nutrition/presentation/NutritionPlanScreen', () => ({
  NutritionPlanScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Meal plan content</Text>;
  },
}));

describe('NutritionPlanRoute', () => {
  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<NutritionPlanRoute />);
    expect(screen.getAllByLabelText('Loading dashboard section').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<NutritionPlanRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the meal plan for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<NutritionPlanRoute />);
    expect(screen.getByText('Meal plan content')).toBeOnTheScreen();
  });
});
