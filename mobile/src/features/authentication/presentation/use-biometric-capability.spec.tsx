import { renderHook, waitFor } from '@testing-library/react-native';

import { useBiometricCapability } from './use-biometric-capability';

const mockGetCapability = jest.fn();
jest.mock('../infrastructure/biometric-capability', () => ({
  getBiometricCapability: () => mockGetCapability(),
}));

describe('useBiometricCapability (ADR-P036)', () => {
  it('is null while reading, then the device capability', async () => {
    mockGetCapability.mockResolvedValue({ available: true, kind: 'face' });
    const view = await renderHook(() => useBiometricCapability());

    await waitFor(() => expect(view.result.current).toEqual({ available: true, kind: 'face' }));
  });

  it('ignores a result that lands after unmount', async () => {
    let resolve: (value: unknown) => void = () => {};
    mockGetCapability.mockReturnValue(new Promise((done) => (resolve = done)));
    const view = await renderHook(() => useBiometricCapability());
    expect(view.result.current).toBeNull();

    await view.unmount();
    resolve({ available: true, kind: 'fingerprint' });
    expect(view.result.current).toBeNull();
  });
});
