import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { logError } from '../../../shared/infrastructure/logging';

/** Which word the copy uses: "Face ID" on iPhones with Face ID, otherwise "huella". */
export type BiometricKind = 'face' | 'fingerprint';

export interface BiometricCapability {
  /** Biometrics can protect a SecureStore key on this device right now. */
  readonly available: boolean;
  readonly kind: BiometricKind;
}

const UNAVAILABLE: BiometricCapability = { available: false, kind: 'fingerprint' };

/**
 * Native biometric capability (ADR-P036). Available only when the device has a
 * sensor, has biometrics enrolled, **and** SecureStore can bind a key to them
 * (`canUseBiometricAuthentication`, which excludes weak Android biometrics).
 * Any failure reads as unavailable, so the feature simply does not appear.
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !enrolled || !SecureStore.canUseBiometricAuthentication()) return UNAVAILABLE;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face =
      Platform.OS === 'ios' &&
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return { available: true, kind: face ? 'face' : 'fingerprint' };
  } catch (error) {
    logError('auth.biometric.capability', error);
    return UNAVAILABLE;
  }
}
