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
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual<typeof import('@/shared/localization/resources/en')>(
    '@/shared/localization/resources/en',
  );
  // The constant stub this replaced ignored the key, so once the shared skeleton
  // started resolving its label through `t()` (BUG-010) it returned this
  // screen's label for the skeleton too. Resolve the skeleton key truthfully and
  // leave every other key on the original stub.
  return {
    useLocalization: () => ({
      t: (key: keyof typeof en) =>
        key === 'common.loadingContentAccessibility' ? en[key] : 'Meal plan',
    }),
  };
});

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
    expect(screen.getAllByLabelText('Loading content').length).toBeGreaterThan(0);
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
