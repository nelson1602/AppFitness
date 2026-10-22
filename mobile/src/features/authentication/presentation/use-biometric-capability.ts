import { useEffect, useState } from 'react';

import {
  type BiometricCapability,
  getBiometricCapability,
} from '../infrastructure/biometric-capability';

/**
 * The device's biometric capability (ADR-P036), or `null` while it is being
 * read. Callers show nothing biometric until it resolves to `available`, so the
 * feature never flashes on a device or platform that cannot use it.
 */
export function useBiometricCapability(): BiometricCapability | null {
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((value) => {
      if (active) setCapability(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return capability;
}
