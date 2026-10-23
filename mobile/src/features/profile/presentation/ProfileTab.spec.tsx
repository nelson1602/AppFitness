import { fireEvent, render, screen } from '@testing-library/react-native';

import { signOut } from '@/features/authentication';

import { ProfileTab } from './ProfileTab';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/authentication', () => ({ signOut: jest.fn() }));
jest.mock('@/shared/localization', () => {
  const actual = jest.requireActual('@/shared/localization');
  const { en } = jest.requireActual('@/shared/localization/resources/en');
  const { es } = jest.requireActual('@/shared/localization/resources/es');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    // The selector has its own spec; here it only has to be present.
    LanguageSelector: () => <RN.Text testID="language-selector">language</RN.Text>,
    useLocalization: () => ({
      language: mockLanguage,
      t: (key: keyof typeof en) => (mockLanguage === 'es' ? es[key] : en[key]),
    }),
  };
});

function push() {
  return jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
});

/**
 * The account actions that closed the dashboard before ADR-P039 live here now;
 * these are the dashboard's former navigation tests, moved with the buttons.
 */
describe('ProfileTab', () => {
  it.each([
    ['View or edit your evaluation and limitations', '/wellness-safety-profile'],
    ['Edit profile', '/profile-edit'],
    ['Edit goal', '/goal-edit'],
    ['View your AppFitness Pro subscription', '/subscription'],
    ['Delete your account', '/delete-account'],
  ] as const)('"%s" opens %s (never acts directly)', async (name, href) => {
    await render(<ProfileTab />);
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(push()).toHaveBeenCalledWith(href);
  });

  it('offers sign-out that clears the session (the route guard handles the redirect)', async () => {
    await render(<ProfileTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out of your account' }));

    expect(jest.mocked(signOut)).toHaveBeenCalledTimes(1);
    expect(push()).not.toHaveBeenCalled();
  });

  it('keeps the language choice and an Account header', async () => {
    await render(<ProfileTab />);

    expect(screen.getByTestId('language-selector')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
  });

  it('renders in Spanish', async () => {
    mockLanguage = 'es';
    await render(<ProfileTab />);

    expect(screen.getByTestId('profile-wellness-safety')).toHaveTextContent(
      'Evaluación y limitaciones',
    );
    expect(screen.getByTestId('profile-subscription').props.accessibilityLabel).toBe(
      'Ver tu suscripción a AppFitness Pro',
    );
    expect(screen.getByText('Cerrar sesión')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Cuenta' })).toBeOnTheScreen();
  });

  it('does not expose dormant medical management actions', async () => {
    await render(<ProfileTab />);

    expect(screen.queryByText('Record evaluation')).toBeNull();
    expect(screen.queryByText('Evaluation history')).toBeNull();
    expect(screen.queryByText('Restrictions & injuries')).toBeNull();
  });
});
