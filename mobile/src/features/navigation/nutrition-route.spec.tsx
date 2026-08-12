import { render, screen } from '@testing-library/react-native';

import NutritionRoute from '@/app/nutrition';

let mockSessionStatus: 'unknown' | 'authenticated' | 'anonymous';
let mockLanguage: 'en' | 'es' = 'en';
let mockStackTitle: string | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect: {href}</Text>;
  },
  Stack: {
    Screen: ({ options }: { options: { title: string } }) => {
      mockStackTitle = options.title;
      return null;
    },
  },
}));

jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus }),
}));
jest.mock('@/shared/localization', () => {
  const { en } = jest.requireActual<typeof import('@/shared/localization/resources/en')>(
    '@/shared/localization/resources/en',
  );
  const { es } = jest.requireActual<typeof import('@/shared/localization/resources/es')>(
    '@/shared/localization/resources/es',
  );

  return {
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es : en)[key],
    }),
  };
});

jest.mock('@/features/nutrition/presentation/NutritionTargets', () => ({
  NutritionTargets: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Nutrition targets content</Text>;
  },
}));

describe('NutritionRoute', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockStackTitle = undefined;
  });

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
    expect(mockStackTitle).toBe('Nutrition');
  });

  it('localizes the native route title in Spanish', async () => {
    mockSessionStatus = 'authenticated';
    mockLanguage = 'es';

    await render(<NutritionRoute />);

    expect(mockStackTitle).toBe('Nutrición');
  });
});
