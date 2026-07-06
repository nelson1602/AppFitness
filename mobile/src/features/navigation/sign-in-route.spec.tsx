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

jest.mock('@/features/authentication', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

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

  it('shows a safe generic error when authentication fails', async () => {
    mockSignIn.mockRejectedValue(new Error('network timeout with token abc123'));

    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Sign-in error')).toBeOnTheScreen();
    expect(
      screen.getByText('Authentication failed. Check the local API and credentials.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/abc123/i)).toBeNull();
  });
});
