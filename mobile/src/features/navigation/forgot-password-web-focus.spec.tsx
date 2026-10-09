import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, View } from 'react-native';

import { requestPasswordReset } from '@/features/authentication';
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

// BUG-035: Web keyboard-focus contract for the recovery request (owner Option
// 1). Jest proves the wiring; the real focus outcome (document.activeElement)
// was verified in headless Chrome in EN and ES.
describe('ForgotPasswordScreen Web focus contract (BUG-035)', () => {
  const focusedTestIDs = (spy: jest.SpyInstance) =>
    spy.mock.contexts.map((c) => (c as { props?: { testID?: string } }).props?.testID);

  let focus: jest.SpyInstance;
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockLanguage = 'en';
    mockRequest.mockReset();
    focus = jest.spyOn(View.prototype as unknown as { focus: () => void }, 'focus');
  });
  afterEach(async () => {
    // Settle every continuation this test started before the tree is cleaned up.
    await act(async () => {});
    jest.restoreAllMocks();
  });

  const field = () => screen.getByTestId('input-forgot-email');
  const enter = async () => {
    await fireEvent(field(), 'submitEditing', { nativeEvent: { text: '' } });
  };

  // First on purpose: a success test earlier in the file can leave a spy
  // context behind on the shared View prototype, which this negative control
  // would otherwise count.
  it('moves no focus on native success (negative control)', async () => {
    jest.restoreAllMocks(); // a single platform override per test
    jest.replaceProperty(Platform, 'OS', 'ios');
    focus = jest.spyOn(View.prototype as unknown as { focus: () => void }, 'focus');
    mockRequest.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(field(), 'person@example.test');

    expect(field().props.onSubmitEditing).toBeUndefined();
    await fireEvent.press(screen.getByTestId('button-forgot-submit'));

    await waitFor(() => expect(screen.queryByTestId('input-forgot-email')).toBeNull());
    expect(focus).not.toHaveBeenCalled();
  });

  it('validates an empty field on Enter without a request or a focus move', async () => {
    await render(<ForgotPasswordScreen />);

    expect(field().props.blurOnSubmit).toBe(false);
    await enter();

    expect(screen.getByText('Enter the email address for your account.')).toBeOnTheScreen();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('sends one request for repeated Enter and keeps the form on failure', async () => {
    let reject: (error: Error) => void = () => {};
    mockRequest.mockReturnValue(new Promise<void>((_resolve, r) => (reject = r)));
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(field(), 'person@example.test');

    await enter();
    await enter();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    // While loading, the button stays enabled and busy on Web (Option 1).
    const button = screen.getByTestId('button-forgot-submit');
    expect(button).not.toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));

    await act(async () => {
      reject(new PasswordRecoveryError('mail-unavailable'));
    });

    expect(field()).toBeOnTheScreen();
    expect(screen.getByText('Password reset is unavailable')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
  });

  it('keeps a button-triggered submission single while loading, and focus unmoved on failure', async () => {
    let reject: (error: Error) => void = () => {};
    mockRequest.mockReturnValue(new Promise<void>((_resolve, r) => (reject = r)));
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(field(), 'person@example.test');

    const button = screen.getByTestId('button-forgot-submit');
    button.props.onClick?.({
      nativeEvent: {},
      persist() {},
      preventDefault() {},
      stopPropagation() {},
    });
    await waitFor(() => expect(button.props.accessibilityState?.busy).toBe(true));
    button.props.onClick?.({
      nativeEvent: {},
      persist() {},
      preventDefault() {},
      stopPropagation() {},
    });
    await enter();
    expect(mockRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      reject(new PasswordRecoveryError('rate-limited'));
    });
    expect(screen.getByTestId('button-forgot-submit')).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses Back to sign in after a successful request', async () => {
    mockRequest.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(field(), 'person@example.test');

    await enter();

    await waitFor(() =>
      expect(new Set(focusedTestIDs(focus))).toEqual(new Set(['button-forgot-back'])),
    );
    expect(screen.queryByTestId('input-forgot-email')).toBeNull();
  });

  it('behaves identically in Spanish', async () => {
    mockLanguage = 'es';
    mockRequest.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await enter();
    expect(screen.getByText('Introduce el correo de tu cuenta.')).toBeOnTheScreen();
    await fireEvent.changeText(field(), 'persona@example.test');
    await enter();

    await waitFor(() =>
      expect(new Set(focusedTestIDs(focus))).toEqual(new Set(['button-forgot-back'])),
    );
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
