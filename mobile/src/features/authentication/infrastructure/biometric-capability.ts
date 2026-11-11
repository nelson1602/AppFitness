import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { logError } from '../../../shared/infrastructure/logging';

/** Which word the copy uses: "Face ID" on iPhones with Face ID, otherwise "huella digital". */
export type BiometricKind = 'face' | 'fingerprint';

/**
 * Why biometrics can or cannot be used (ADR-P036): `ready`; `not-enrolled`
 * (a sensor, but nothing enrolled in the phone's settings); `unsupported` (no
 * sensor, or only one SecureStore cannot bind a key to, such as a weak Android
 * face unlock, or Web).
 */
export type BiometricReadiness = 'ready' | 'not-enrolled' | 'unsupported';

export interface BiometricCapability {
  /** Biometrics can protect a SecureStore key on this device right now. */
  readonly available: boolean;
  readonly kind: BiometricKind;
  readonly readiness: BiometricReadiness;
}

const UNSUPPORTED: BiometricCapability = {
  available: false,
  kind: 'fingerprint',
  readiness: 'unsupported',
};

/**
 * Native biometric capability (ADR-P036). Available only when the device has a
 * sensor, has biometrics enrolled, **and** SecureStore can bind a key to them
 * (`canUseBiometricAuthentication`, which excludes weak Android biometrics).
 * Any failure reads as unsupported, so the feature never offers itself where it
 * cannot work.
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hardware) return UNSUPPORTED;
    // "Face ID" is the iPhone's name for it; Android always uses the fingerprint wording.
    const kind: BiometricKind =
      Platform.OS === 'ios' &&
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'face'
        : 'fingerprint';
    if (!enrolled) return { available: false, kind, readiness: 'not-enrolled' };
    if (!SecureStore.canUseBiometricAuthentication()) return UNSUPPORTED;
    return { available: true, kind, readiness: 'ready' };
  } catch (error) {
    logError('auth.biometric.capability', error);
    return UNSUPPORTED;
  }
}
