import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const mockReplace = jest.fn();
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (href: string) => mockReplace(href),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@/features/authentication', () => {
  // Real-shaped AuthError so `error instanceof AuthError` works in the screen.
  // Factory-local, mock-prefixed name to satisfy babel-jest-hoist.
  class MockAuthError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = 'AuthError';
      this.reason = reason;
    }
  }
  return {
    AuthError: MockAuthError,
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signUp: (...args: unknown[]) => mockSignUp(...args),
  };
});

const { AuthError } = jest.requireMock<{
  AuthError: new (reason: string) => Error & { reason: string };
}>('@/features/authentication');

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue(undefined);
    mockSignUp.mockResolvedValue(undefined);
  });

  it('renders the development sign-in form', async () => {
    await render(<SignInScreen />);

    expect(screen.getByText('AppFitness')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('signs in and redirects to the dashboard', async () => {
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'user@appfitness.local',
        password: 'password12345',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('switches to registration and submits username', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByLabelText('Switch authentication mode'));
    expect(screen.getByLabelText('Username')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Username'), 'new-user');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Register'));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@appfitness.local',
        username: 'new-user',
        password: 'password12345',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a distinct invalid-credentials error on sign-in 401', async () => {
    mockSignIn.mockRejectedValue(new AuthError('invalid-credentials'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Sign-in failed')).toBeOnTheScreen();
    expect(
      screen.getByText('That email or password is incorrect. Please try again.'),
    ).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a connectivity error when the network is unreachable', async () => {
    mockSignIn.mockRejectedValue(new AuthError('connectivity'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('No connection')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We couldn't reach AppFitness. Check your internet connection and try again.",
      ),
    ).toBeOnTheScreen();
  });

  it('shows a server error on an unexpected API response', async () => {
    mockSignIn.mockRejectedValue(new AuthError('server'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText('AppFitness is having trouble right now. Please try again in a moment.'),
    ).toBeOnTheScreen();
  });

  it('shows an unexpected (post-auth) error and never leaks raw error text', async () => {
    // A post-auth/local failure surfaces as a plain Error → mapped to unexpected;
    // credentials were valid, so it must NOT read as a credential error.
    mockSignIn.mockRejectedValue(new Error('SecureStore write failed: token abc123'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();
    expect(
      screen.getByText("We couldn't finish signing you in on this device. Please try again."),
    ).toBeOnTheScreen();
    // Raw error text/token never rendered; not misclassified as invalid credentials.
    expect(screen.queryByText(/abc123/i)).toBeNull();
    expect(screen.queryByText('Sign-in failed')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a non-enumerating registration error on register conflict', async () => {
    mockSignUp.mockRejectedValue(new AuthError('registration-unavailable'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByLabelText('Switch authentication mode'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'taken@appfitness.local');
    await fireEvent.changeText(screen.getByLabelText('Username'), 'taken-user');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password12345');
    await fireEvent.press(screen.getByText('Register'));

    expect(await screen.findByText("Couldn't create account")).toBeOnTheScreen();
    expect(
      screen.getByText("We couldn't create your account with those details. Try different ones."),
    ).toBeOnTheScreen();
    // No account-existence disclosure / no echoed identifiers.
    expect(screen.queryByText(/already (exists|registered|taken)/i)).toBeNull();
    expect(screen.queryByText(/taken@appfitness\.local/)).toBeNull();
    expect(screen.queryByText(/taken-user/)).toBeNull();
  });
});
