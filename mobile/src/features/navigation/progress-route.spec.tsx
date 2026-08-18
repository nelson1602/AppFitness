import { render } from '@testing-library/react-native';

import ProgressRoute from '../../app/progress';

let mockSessionStatus: 'authenticated' | 'unauthenticated' | 'unknown' = 'authenticated';
let mockLanguage: 'en' | 'es' = 'en';
let mockStackOptions: { title?: string } | null = null;

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: { options?: { title?: string } }) => {
      mockStackOptions = props.options ?? null;
      return null;
    },
  },
  Redirect: () => null,
}));
jest.mock('@/features/authentication', () => ({
  useSession: () => ({ status: mockSessionStatus, session: null }),
}));
jest.mock('@/features/progress', () => ({ ProgressScreen: () => null }));
jest.mock('@/features/dashboard/presentation/components/dashboard-skeleton', () => ({
  DashboardSkeleton: () => null,
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

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionStatus = 'authenticated';
  mockLanguage = 'en';
  mockStackOptions = null;
});

describe('ProgressRoute (Slice 2B5-1)', () => {
  it('sets the localized native header title in English', async () => {
    await render(<ProgressRoute />);
    expect(mockStackOptions?.title).toBe('Progress');
  });

  it('sets the localized native header title in Spanish', async () => {
    mockLanguage = 'es';
    await render(<ProgressRoute />);
    expect(mockStackOptions?.title).toBe('Progreso');
  });
});
