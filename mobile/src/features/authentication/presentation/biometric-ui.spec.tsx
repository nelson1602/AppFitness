import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { es } from '@/shared/localization/resources/es';

import type { BiometricCapability } from '../infrastructure/biometric-capability';
import { BiometricLinkSheet } from './biometric-link-sheet';
import { BiometricSwitch } from './biometric-switch';

const mockLink = jest.fn();
const mockUnlink = jest.fn();
const mockIsLinked = jest.fn();
let mockCapability: BiometricCapability | null = null;

jest.mock('../application/session-manager', () => ({
  linkBiometrics: (...args: unknown[]) => mockLink(...args),
  unlinkBiometrics: (...args: unknown[]) => mockUnlink(...args),
  isBiometricLinked: () => mockIsLinked(),
}));
jest.mock('./use-biometric-capability', () => ({
  useBiometricCapability: () => mockCapability,
}));

describe('BiometricLinkSheet (ADR-P036 A1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(ReactNative.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['face', 'Turn on Face ID', 'Link your account to Face ID'],
    ['fingerprint', 'Turn on fingerprint', 'Link your account to your fingerprint'],
  ] as const)('offers %s with the design copy and the privacy note', async (kind, cta, body) => {
    await render(<BiometricLinkSheet kind={kind} onDone={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Sign in faster next time?' })).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(body))).toBeOnTheScreen();
    expect(screen.getByText(/Your biometric data stays on your phone/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: cta })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeOnTheScreen();
  });

  it('links with the confirm prompt and waits for the person to continue', async () => {
    mockLink.mockResolvedValue('linked');
    const onDone = jest.fn();
    await render(<BiometricLinkSheet kind="fingerprint" onDone={onDone} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

    expect(await screen.findByRole('header', { name: 'Fingerprint turned on' })).toBeOnTheScreen();
    expect(mockLink).toHaveBeenCalledWith("Confirm it's you");
    // No auto-advance: nothing moves on until the person chooses to.
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to my dashboard' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('returns to the offer when the prompt is cancelled', async () => {
    mockLink.mockResolvedValue('cancelled');
    await render(<BiometricLinkSheet kind="fingerprint" onDone={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Turn on fingerprint' })).toBeEnabled(),
    );
    expect(screen.queryByText('Fingerprint turned on')).toBeNull();
  });

  it('explains a failed link and still lets the person continue', async () => {
    mockLink.mockResolvedValue('failed');
    const onDone = jest.fn();
    await render(<BiometricLinkSheet kind="fingerprint" onDone={onDone} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Turn on fingerprint' }));

    expect(await screen.findByText(/couldn't turn it on right now/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to my dashboard' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('declines without linking', async () => {
    const onDone = jest.fn();
    await render(<BiometricLinkSheet kind="face" onDone={onDone} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockLink).not.toHaveBeenCalled();
  });
});

describe('BiometricSwitch (ADR-P036 A7, Perfil → Seguridad)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapability = { available: true, kind: 'fingerprint', readiness: 'ready' };
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stays off and disabled, and says why, on a phone without biometrics', async () => {
    mockCapability = { available: false, kind: 'fingerprint', readiness: 'unsupported' };
    await render(<BiometricSwitch />);

    const toggle = screen.getByRole('switch', { name: 'Sign in with Face ID or fingerprint' });
    expect(toggle).toHaveProp('accessibilityState', { checked: false, disabled: true });
    expect(screen.getByTestId('biometric-switch-status')).toHaveTextContent(
      "This phone doesn't have biometrics",
    );
    expect(
      screen.getByTestId('biometric-switch-track', { includeHiddenElements: true }),
    ).toHaveStyle({ opacity: 0.4 });
    expect(mockIsLinked).not.toHaveBeenCalled();
  });

  it.each([
    ['face', 'Sign in with Face ID', "Set up Face ID in your phone's settings"],
    ['fingerprint', 'Sign in with fingerprint', "Set up your fingerprint in your phone's settings"],
  ] as const)(
    'names %s and points to the phone settings when nothing is enrolled',
    async (kind, name, status) => {
      mockCapability = { available: false, kind, readiness: 'not-enrolled' };
      await render(<BiometricSwitch />);

      expect(screen.getByRole('switch', { name })).toHaveProp('accessibilityState', {
        checked: false,
        disabled: true,
      });
      expect(screen.getByTestId('biometric-switch-status')).toHaveTextContent(status);
    },
  );

  it('turns biometrics on with a prompt and reports the checked state', async () => {
    mockIsLinked.mockResolvedValue(false);
    mockLink.mockResolvedValue('linked');
    await render(<BiometricSwitch />);

    const toggle = await screen.findByRole('switch', { name: 'Sign in with fingerprint' });
    expect(toggle).toHaveProp('accessibilityState', { checked: false, disabled: false });
    expect(toggle).toHaveStyle({ minHeight: 48 });
    expect(screen.getByTestId('biometric-switch-status')).toHaveTextContent('Off');

    await fireEvent.press(toggle);
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveProp('accessibilityState', {
        checked: true,
        disabled: false,
      }),
    );
    expect(screen.getByTestId('biometric-switch-status')).toHaveTextContent('On');
    expect(
      screen.getByTestId('biometric-switch-track', { includeHiddenElements: true }),
    ).toHaveStyle({ alignItems: 'flex-end' });
    expect(mockLink).toHaveBeenCalledWith("Confirm it's you");
  });

  it('keeps it off when linking is cancelled or fails', async () => {
    mockIsLinked.mockResolvedValue(false);
    mockLink.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('failed');
    await render(<BiometricSwitch />);
    const toggle = await screen.findByRole('switch');

    await fireEvent.press(toggle);
    await waitFor(() => expect(mockLink).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(false);

    await fireEvent.press(screen.getByRole('switch'));
    await waitFor(() => expect(mockLink).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(false);
  });

  it('turns biometrics off with a prompt, and keeps them on when cancelled', async () => {
    mockCapability = { available: true, kind: 'face', readiness: 'ready' };
    mockIsLinked.mockResolvedValue(true);
    mockUnlink.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('unlinked');
    await render(<BiometricSwitch />);
    const toggle = await screen.findByRole('switch', { name: 'Sign in with Face ID' });

    await fireEvent.press(toggle);
    await waitFor(() => expect(mockUnlink).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(true);

    await fireEvent.press(screen.getByRole('switch'));
    await waitFor(() =>
      expect(screen.getByRole('switch').props.accessibilityState.checked).toBe(false),
    );
  });

  it('uses "Face ID" or "Huella digital" in Spanish, by hardware', () => {
    expect(es['auth.biometric.signInFace']).toBe('Entrar con Face ID');
    expect(es['auth.biometric.signInFingerprint']).toBe('Entrar con huella digital');
    expect(es['auth.biometric.switch']).toBe('Entrar con Face ID o Huella');
    expect(es['auth.biometric.switchOn']).toBe('Activado');
    expect(es['auth.biometric.switchOff']).toBe('Desactivado');
    expect(es['auth.biometric.switchNoHardware']).toBe('Este teléfono no tiene biometría');
    expect(es['auth.biometric.securityTitle']).toBe('Seguridad');
  });
});
