import { fireEvent, render, screen } from '@testing-library/react-native';

import SignInScreen from './sign-in';

// Behavioral coverage (submit, error banner, register flow) lives in
// src/features/navigation/sign-in-route.spec.tsx. This spec guards the
// RELEASE PRODUCT GATE only: no prefilled credentials, no dev copy.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn() },
}));
jest.mock('@/features/authentication', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
}));

describe('SignInScreen release product gate', () => {
  it('never prefills credentials and ships no dev copy (10_DEPLOYMENT.md checklist)', async () => {
    await render(<SignInScreen />);

    expect(screen.getByTestId('input-email').props.value).toBe('');
    expect(screen.getByTestId('input-password').props.value).toBe('');
    expect(screen.queryByText(/demo@appfitness\.local/)).toBeNull();
    expect(screen.queryByText(/password12345/)).toBeNull();
    expect(screen.queryByText(/Minimal development sign-in/)).toBeNull();
    expect(screen.getByText('Sign in to continue.')).toBeOnTheScreen();
  });

  it('register mode also starts with an empty username', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Switch authentication mode' }));

    expect(screen.getByTestId('input-username').props.value).toBe('');
    expect(screen.getByTestId('input-email').props.value).toBe('');
  });
});
