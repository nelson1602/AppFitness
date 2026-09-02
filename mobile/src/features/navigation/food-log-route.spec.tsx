import { render, screen } from '@testing-library/react-native';

import FoodLogRoute from '@/app/food-log';

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

jest.mock('@/features/nutrition/presentation/FoodLogScreen', () => ({
  FoodLogScreen: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Food log content</Text>;
  },
}));

describe('FoodLogRoute', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockStackTitle = undefined;
  });

  it('shows a skeleton while session restoration is pending', async () => {
    mockSessionStatus = 'unknown';
    await render(<FoodLogRoute />);
    expect(screen.getAllByLabelText('Loading content').length).toBeGreaterThan(0);
  });

  it('redirects anonymous users to sign in', async () => {
    mockSessionStatus = 'anonymous';
    await render(<FoodLogRoute />);
    expect(screen.getByText('Redirect: /sign-in')).toBeOnTheScreen();
  });

  it('renders the food log for authenticated users', async () => {
    mockSessionStatus = 'authenticated';
    await render(<FoodLogRoute />);
    expect(screen.getByText('Food log content')).toBeOnTheScreen();
    expect(mockStackTitle).toBe('Food log');
  });

  it('localizes the native route title in Spanish', async () => {
    mockSessionStatus = 'authenticated';
    mockLanguage = 'es';

    await render(<FoodLogRoute />);

    expect(mockStackTitle).toBe('Registro de alimentos');
  });
});
