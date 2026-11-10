import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const mockReplace = jest.fn();
const mockSignUp = jest.fn();
const mockRemember = jest.fn();
const mockDeviceCountry = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (href: unknown) => mockReplace(href), push: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock('@/features/authentication', () => ({
  AuthError: class extends Error {},
  signIn: jest.fn(),
  signUp: (...args: unknown[]) => mockSignUp(...args),
  // ADR-P036: no biometrics in this spec.
  getSession: () => null,
  useSession: () => ({ status: 'unauthenticated', session: null }),
  useBiometricCapability: () => null,
  unlockWithBiometrics: jest.fn(),
  BiometricLinkSheet: () => null,
}));

jest.mock('@/features/profile', () => ({
  rememberMySignupCountry: (...args: unknown[]) => mockRemember(...args),
  deviceDefaultCountry: () => mockDeviceCountry(),
}));

const NEW_ACCOUNT = {
  status: 'authenticated',
  session: { user: { id: 'user-new', emailVerifiedAt: null } },
};

async function openRegistration() {
  await render(<SignInScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
}

async function register() {
  await fireEvent.changeText(screen.getByLabelText('Email'), 'new@appfitness.local');
  await fireEvent.changeText(screen.getByLabelText('Username'), 'new-user');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Password-12345');
  await fireEvent.press(screen.getByText('Create account'));
}

/** v8.1 — "País" on the sign-up form. */
describe('sign-up country', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue(NEW_ACCOUNT);
    mockRemember.mockResolvedValue(undefined);
    mockDeviceCountry.mockReturnValue('DO');
  });

  it('is shown only while creating an account', async () => {
    await render(<SignInScreen />);
    expect(screen.queryByTestId('input-country')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByTestId('input-country')).toBeOnTheScreen();
  });

  it('preselects the device region and keeps it for the new account', async () => {
    mockDeviceCountry.mockReturnValue('MX');
    await openRegistration();

    expect(screen.getByTestId('input-country-value')).toHaveTextContent('Mexico');
    await register();

    await waitFor(() => expect(mockRemember).toHaveBeenCalledWith('user-new', 'MX'));
    // The country is not part of the registration request.
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.not.objectContaining({ country: expect.anything() }),
    );
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/verify-pending',
      params: { sent: '1' },
    });
  });

  it('defaults to the Dominican Republic and keeps the one picked from the radio list', async () => {
    await openRegistration();
    expect(screen.getByTestId('input-country-value')).toHaveTextContent('Dominican Republic');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Change country. Now: Dominican Republic' }),
    );
    expect(screen.getByRole('radio', { name: 'Country: Dominican Republic' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Country: Spain' }));
    expect(screen.getByTestId('input-country-value')).toHaveTextContent('Spain');

    await register();
    await waitFor(() => expect(mockRemember).toHaveBeenCalledWith('user-new', 'ES'));
  });

  it('offers "Another country" last, after the United States and Spain', async () => {
    await openRegistration();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Change country. Now: Dominican Republic' }),
    );
    const names = screen
      .getAllByRole('radio')
      .map((radio) => radio.props.accessibilityLabel as string)
      .filter((name) => name.startsWith('Country: '));
    expect(names[0]).toBe('Country: Dominican Republic');
    expect(names.slice(-3)).toEqual([
      'Country: United States',
      'Country: Spain',
      'Country: Another country',
    ]);
    expect(names).toHaveLength(22);
  });

  it('remembers nothing for a sign-in', async () => {
    await render(<SignInScreen />);
    expect(mockRemember).not.toHaveBeenCalled();
  });
});
