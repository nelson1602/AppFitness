import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DeleteAccountError, deleteAccount } from '@/features/authentication';
import DeleteAccountScreen from '../../app/delete-account';

let mockSessionStatus: 'authenticated' | 'unauthenticated' | 'unknown' = 'authenticated';
let mockLanguage: 'en' | 'es' = 'en';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Redirect: () => null,
  router: { replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/features/authentication', () => ({
  DeleteAccountError: class DeleteAccountError extends Error {
    readonly reason: string;
    constructor(mockReason: string) {
      super(mockReason);
      this.reason = mockReason;
    }
  },
  deleteAccount: jest.fn(),
  useSession: () => ({ status: mockSessionStatus, session: null }),
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

const mockDeleteAccount = jest.mocked(deleteAccount);

/** v10 Block C: the confirmation comes after the retention step. */
async function renderConfirmStep() {
  await render(<DeleteAccountScreen />);
  const label = mockLanguage === 'es' ? 'Continuar con la eliminación' : 'Continue to delete';
  await fireEvent.press(screen.getByRole('button', { name: label }));
}

describe('DeleteAccountScreen (Step 6B product surface)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStatus = 'authenticated';
    mockLanguage = 'en';
  });

  it('opens on a retention step that says what is lost and offers to stay (v10 Block C, item 12)', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockLanguage = 'es';
    await render(<DeleteAccountScreen />);

    expect(screen.getByRole('header', { name: 'Antes de irte' })).toBeOnTheScreen();
    expect(screen.getByText(/plan de entrenamientos y de comidas/)).toBeOnTheScreen();
    expect(screen.getByText(/historial de peso y medidas/)).toBeOnTheScreen();
    expect(screen.getByText(/cancélala en Google Play/)).toBeOnTheScreen();
    expect(screen.queryByTestId('input-confirm-phrase')).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Prefiero quedarme y conservar mi cuenta' }),
    );
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('reaches the typed confirmation only after "Continuar con la eliminación"', async () => {
    mockLanguage = 'es';
    await renderConfirmStep();

    expect(screen.getByTestId('input-confirm-phrase')).toBeOnTheScreen();
    expect(screen.queryByText('Antes de irte')).toBeNull();
  });

  it('does not delete until the confirmation phrase is typed exactly', async () => {
    await renderConfirmStep();

    const confirm = screen.getByRole('button', { name: 'Permanently delete account' });
    // Disabled + guarded before the phrase matches.
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(confirm);
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    // Wrong phrase stays disabled.
    await fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'delete please');
    await fireEvent.press(confirm);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('deletes and routes to sign-in once DELETE is confirmed', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockDeleteAccount.mockResolvedValue(undefined);
    await renderConfirmStep();

    await fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');
    await fireEvent.changeText(screen.getByTestId('input-delete-password'), 'Disposable-pw-1!');
    // Wait for the confirmation to enable the button before pressing.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Permanently delete account' }).props.accessibilityState
          ?.disabled,
      ).toBe(false),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith('Disposable-pw-1!'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('stays disabled with the phrase but no password (ADR-P046)', async () => {
    await renderConfirmStep();

    await fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');

    expect(screen.getByRole('button', { name: 'Permanently delete account' })).toBeDisabled();
    expect(screen.getByLabelText('Current password to delete the account')).toHaveProp(
      'secureTextEntry',
      true,
    );
  });

  it.each([
    ['wrong-password', 'That password is incorrect. Please try again.'],
    ['locked', 'Too many attempts. For your security, wait a few minutes before trying again.'],
    ['connectivity', 'You’re offline. Connect to the internet to delete your account.'],
  ] as const)(
    'a %s refusal says so, clears the password and keeps the account',
    async (reason, copy) => {
      const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
      mockDeleteAccount.mockRejectedValue(new DeleteAccountError(reason));
      await renderConfirmStep();

      await fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');
      await fireEvent.changeText(screen.getByTestId('input-delete-password'), 'Disposable-pw-1!');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Permanently delete account' })).toBeEnabled(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

      expect(await screen.findByText(copy)).toBeOnTheScreen();
      expect(screen.getByTestId('input-delete-password')).toHaveProp('value', '');
      expect(router.replace).not.toHaveBeenCalled();
    },
  );

  it('shows a safe error and stays put when deletion fails', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    mockDeleteAccount.mockRejectedValue(new Error('500 boom token=secret'));
    await renderConfirmStep();

    await fireEvent.changeText(screen.getByTestId('input-confirm-phrase'), 'DELETE');
    await fireEvent.changeText(screen.getByTestId('input-delete-password'), 'Disposable-pw-1!');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Permanently delete account' }).props.accessibilityState
          ?.disabled,
      ).toBe(false),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText('Deletion failed')).toBeOnTheScreen();
    expect(
      screen.getByText('We could not delete your account. Please try again.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/secret/)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('cancel returns without deleting', async () => {
    const { router } = jest.requireMock<typeof import('expo-router')>('expo-router');
    await renderConfirmStep();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel account deletion' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('renders the complete destructive action surface in Spanish', async () => {
    mockLanguage = 'es';
    await renderConfirmStep();

    // v8 Block 3: the stack header names the screen; the page does not repeat it.
    expect(screen.queryByText('Eliminar cuenta')).toBeNull();
    expect(screen.getByText('Escribe DELETE para confirmar')).toBeOnTheScreen();
    expect(screen.getByLabelText('Frase de confirmación para eliminar la cuenta')).toHaveProp(
      'testID',
      'input-confirm-phrase',
    );
    expect(screen.getByRole('button', { name: 'Eliminar cuenta permanentemente' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancelar la eliminación de la cuenta' }),
    ).toBeOnTheScreen();
  });

  /**
   * BUG-022. The screen used the fixed (`scroll={false}`) form, where the
   * Android keyboard covered the confirm and cancel actions with no way to reach
   * them. It now uses the scrollable form, which is the one `Screen` adds keyboard
   * clearance to, and keeps its centred presentation by growing — never
   * shrinking — to the viewport.
   */
  it('renders inside a scroll view so the keyboard cannot cover its actions', async () => {
    await renderConfirmStep();

    const root = screen.root;
    if (root === null) throw new Error('Screen rendered no root');
    const [scrollView] = root.queryAll((node) => node.type === 'RCTScrollView');
    expect(scrollView).toBeDefined();
    expect(StyleSheet.flatten(scrollView?.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
    });
  });

  it('keeps its content centred when the keyboard is absent', async () => {
    await renderConfirmStep();

    const root = screen.root;
    if (root === null) throw new Error('Screen rendered no root');
    const [column] = root.queryAll(
      (node) =>
        node.type === 'View' && StyleSheet.flatten(node.props.style)?.justifyContent === 'center',
    );
    const columnStyle = StyleSheet.flatten(column?.props.style);
    expect(columnStyle).toMatchObject({ flexGrow: 1, justifyContent: 'center' });
    // `flex: 1` would let the column shrink below its content inside a scroll view.
    expect(columnStyle?.flex).toBeUndefined();
  });

  it('redirects to sign-in when unauthenticated', async () => {
    mockSessionStatus = 'unauthenticated';
    await render(<DeleteAccountScreen />);

    expect(screen.queryByTestId('input-confirm-phrase')).toBeNull();
  });
});
