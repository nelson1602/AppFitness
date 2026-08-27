import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { type PasswordRecoveryErrorReason, requestPasswordReset } from '@/features/authentication';
import ForgotPasswordScreen from '../../app/forgot-password';

let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn(), push: jest.fn() },
}));
jest.mock('@/features/authentication', () => {
  class PasswordRecoveryError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.name = 'PasswordRecoveryError';
      this.reason = reason;
    }
  }
  return { requestPasswordReset: jest.fn(), PasswordRecoveryError };
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

const mockRequest = jest.mocked(requestPasswordReset);
const { PasswordRecoveryError } = jest.requireMock<typeof import('@/features/authentication')>(
  '@/features/authentication',
);

/**
 * ADR-P026 Vertical 1: the request screen must look identical whether or not
 * the address belongs to an account, and must never show raw server text.
 */
describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'en';
    mockRequest.mockResolvedValue(undefined);
  });

  const submit = () => fireEvent.press(screen.getByTestId('button-forgot-submit'));

  it('sends the trimmed address with the active locale', async () => {
    mockLanguage = 'es';
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByTestId('input-forgot-email'), '  user@example.test  ');
    await submit();

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith({
        email: 'user@example.test',
        locale: 'es',
      }),
    );
  });

  it('requires an address before calling the API', async () => {
    await render(<ForgotPasswordScreen />);

    await submit();

    expect(await screen.findByText('Enter the email address for your account.')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('shows the same non-committal confirmation regardless of the address', async () => {
    // Two independent renders, each queried through its own handle so the
    // trees cannot be confused for one another.
    const known = await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(known.getByTestId('input-forgot-email'), 'known@example.test');
    await fireEvent.press(known.getByTestId('button-forgot-submit'));
    const knownCopy = (await known.findByText(/If an account exists for that address/)).props
      .children as string;

    const unknown = await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(unknown.getByTestId('input-forgot-email'), 'unknown@example.test');
    await fireEvent.press(unknown.getByTestId('button-forgot-submit'));
    const unknownCopy = (await unknown.findByText(/If an account exists for that address/)).props
      .children as string;

    // Byte-identical copy, and neither variant echoes the address back.
    expect(unknownCopy).toBe(knownCopy);
    expect(unknownCopy).not.toContain('unknown@example.test');
  });

  it('hides the form once the request is accepted', async () => {
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('input-forgot-email'), 'user@example.test');
    await submit();

    await waitFor(() => expect(screen.queryByTestId('button-forgot-submit')).toBeNull());
    expect(screen.getByText('Check your email')).toBeTruthy();
  });

  it.each<[PasswordRecoveryErrorReason, string]>([
    ['mail-unavailable', 'Password reset is unavailable'],
    ['rate-limited', 'Too many attempts'],
    ['connectivity', 'No connection'],
    ['server', 'Something went wrong'],
  ])('maps the %s reason to localized copy', async (reason, title) => {
    mockRequest.mockRejectedValue(new PasswordRecoveryError(reason));
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByTestId('input-forgot-email'), 'user@example.test');
    await submit();

    expect(await screen.findByText(title)).toBeTruthy();
    // The form stays available for a retry; no confirmation is shown.
    expect(screen.getByTestId('button-forgot-submit')).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('never renders raw server text for an unrecognized failure', async () => {
    mockRequest.mockRejectedValue(new Error('no account for user@example.test'));
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByTestId('input-forgot-email'), 'user@example.test');
    await submit();

    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/no account for/)).toBeNull();
  });

  it('renders Spanish copy when the app language is Spanish', async () => {
    mockLanguage = 'es';
    await render(<ForgotPasswordScreen />);

    expect(screen.getByText('Restablece tu contraseña')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('input-forgot-email'), 'user@example.test');
    await submit();
    expect(await screen.findByText('Revisa tu correo')).toBeTruthy();
  });

  it('routes back to sign in', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    await render(<ForgotPasswordScreen />);

    await fireEvent.press(screen.getByTestId('button-forgot-back'));

    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });
});
