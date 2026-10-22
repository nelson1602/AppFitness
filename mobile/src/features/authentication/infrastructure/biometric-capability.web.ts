import type { BiometricCapability } from './biometric-capability';

export type { BiometricCapability, BiometricKind } from './biometric-capability';

/** Web has no biometric sign-in (ADR-P036 Decision 1, ADR-P018). */
export function getBiometricCapability(): Promise<BiometricCapability> {
  return Promise.resolve({ available: false, kind: 'fingerprint' });
}
