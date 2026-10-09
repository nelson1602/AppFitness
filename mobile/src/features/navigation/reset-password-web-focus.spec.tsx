import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, View } from 'react-native';

import { resetPassword } from '@/features/authentication';
import ResetPasswordScreen from '../../app/reset-password';

let mockLanguage: 'en' | 'es' = 'en';
let mockParams: { token?: string | string[] } = { token: 'raw-token-from-link' };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

// Drive the browser seam directly: jest-expo runs these specs in the native
// environment, so `currentWebLocation()` would otherwise always report null.
let mockWebLocation: { pathname: string; search: string; hash: string } | null = null;
const mockReplaceState = jest.fn();

jest.mock('@/features/authentication/presentation/reset-link.web-location', () => {
  const actual = jest.requireActual<
    typeof import('@/features/authentication/presentation/reset-link.web-location')
  >('@/features/authentication/presentation/reset-link.web-location');
  return {
    ...actual,
    currentWebLocation: () => mockWebLocation,
    currentWebHistory: () => (mockWebLocation ? { replaceState: mockReplaceState } : null),
  };
});
jest.mock('@/features/authentication', () => {
  class PasswordRecoveryError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = 'PasswordRecoveryError';
      this.reason = reason;
    }
  }
  return { resetPassword: jest.fn(), PasswordRecoveryError };
});
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

const mockReset = jest.mocked(resetPassword);
const { PasswordRecoveryError } = jest.requireMock<typeof import('@/features/authentication')>(
  '@/features/authentication',
);

// BUG-035: Web keyboard-focus contract for choosing a new password (owner
// Option 1). Jest proves the wiring; the real focus outcome was verified in
// headless Chrome in EN and ES.
describe('ResetPasswordScreen Web focus contract (BUG-035)', () => {
  const focusedTestIDs = (spy: jest.SpyInstance) =>
    spy.mock.contexts.map((c) => (c as { props?: { testID?: string } }).props?.testID);

  let focus: jest.SpyInstance;
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockLanguage = 'en';
    mockParams = { token: 'raw-token-from-link' };
    mockWebLocation = null;
    mockReset.mockReset();
    focus = jest.spyOn(View.prototype as unknown as { focus: () => void }, 'focus');
  });
  afterEach(async () => {
    // Settle every continuation this test started before the tree is cleaned up.
    await act(async () => {});
    jest.restoreAllMocks();
  });

  const newPassword = () => screen.getByTestId('input-new-password');
  const confirm = () => screen.getByTestId('input-confirm-password');
  const enterIn = async (input: ReturnType<typeof screen.getByTestId>) => {
    await fireEvent(input, 'submitEditing', { nativeEvent: { text: '' } });
  };

  // First on purpose: a success test earlier in the file can leave a spy
  // context behind on the shared View prototype, which this negative control
  // would otherwise count.
  it('moves no focus on native success (negative control)', async () => {
    jest.restoreAllMocks(); // a single platform override per test
    jest.replaceProperty(Platform, 'OS', 'android');
    focus = jest.spyOn(View.prototype as unknown as { focus: () => void }, 'focus');
    mockReset.mockResolvedValue(undefined);
    await render(<ResetPasswordScreen />);
    await fireEvent.changeText(newPassword(), 'Abcdefgh12');
    await fireEvent.changeText(confirm(), 'Abcdefgh12');

    expect(confirm().props.onSubmitEditing).toBeUndefined();
    await fireEvent.press(screen.getByTestId('button-reset-submit'));

    await waitFor(() => expect(screen.getByTestId('button-reset-sign-in')).toBeOnTheScreen());
    expect(focus).not.toHaveBeenCalled();
  });

  it('validates on Enter from either field without a request or a focus move', async () => {
    await render(<ResetPasswordScreen />);
    expect(newPassword().props.blurOnSubmit).toBe(false);
    expect(confirm().props.blurOnSubmit).toBe(false);

    await fireEvent.changeText(newPassword(), 'short');
    await enterIn(newPassword());
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();

    await fireEvent.changeText(newPassword(), 'Abcdefgh12');
    await fireEvent.changeText(confirm(), 'Different12');
    await enterIn(confirm());
    expect(screen.getByText('Both passwords must match.')).toBeOnTheScreen();

    expect(mockReset).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('sends one request for repeated Enter and keeps the form on failure', async () => {
    let reject: (error: Error) => void = () => {};
    mockReset.mockReturnValue(new Promise<void>((_resolve, r) => (reject = r)));
    await render(<ResetPasswordScreen />);
    await fireEvent.changeText(newPassword(), 'Abcdefgh12');
    await fireEvent.changeText(confirm(), 'Abcdefgh12');

    await enterIn(confirm());
    await enterIn(newPassword());
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('button-reset-submit')).not.toBeDisabled();

    await act(async () => {
      reject(new PasswordRecoveryError('mail-unavailable'));
    });
    expect(confirm()).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses Go to sign in after a successful reset', async () => {
    mockReset.mockResolvedValue(undefined);
    await render(<ResetPasswordScreen />);
    await fireEvent.changeText(newPassword(), 'Abcdefgh12');
    await fireEvent.changeText(confirm(), 'Abcdefgh12');

    await enterIn(confirm());

    await waitFor(() =>
      expect(new Set(focusedTestIDs(focus))).toEqual(new Set(['button-reset-sign-in'])),
    );
    expect(screen.queryByTestId('input-new-password')).toBeNull();
  });

  it('behaves identically in Spanish', async () => {
    mockLanguage = 'es';
    mockReset.mockResolvedValue(undefined);
    await render(<ResetPasswordScreen />);
    await fireEvent.changeText(newPassword(), 'Abcdefgh12');
    await fireEvent.changeText(confirm(), 'Abcdefgh12');

    await enterIn(newPassword());

    await waitFor(() =>
      expect(new Set(focusedTestIDs(focus))).toEqual(new Set(['button-reset-sign-in'])),
    );
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
