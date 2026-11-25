import { Platform } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { EMPTY_APP_CONFIG } from '../domain/app-config';
import { readInstalledVersionCode } from '../infrastructure/installed-app';
import { useAppConfigStore } from './app-config.store';
import { selectUpdateRequired, useUpdateRequired } from './update-required';

jest.mock('../infrastructure/app-config-api', () => ({ fetchAppConfig: jest.fn() }));
jest.mock('../infrastructure/installed-app', () => ({ readInstalledVersionCode: jest.fn() }));

const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

const withMinimum = (minAndroidVersionCode: number | null) => ({
  config: { ...EMPTY_APP_CONFIG, minAndroidVersionCode },
});

beforeEach(() => {
  setOS('android');
  jest.mocked(readInstalledVersionCode).mockReset().mockReturnValue(16);
  useAppConfigStore.setState({ config: EMPTY_APP_CONFIG, lastAttemptAt: null });
});

afterAll(() => setOS(originalOS));

describe('selectUpdateRequired (ADR-P049 amendment 1)', () => {
  it('is true on Android below the minimum', () => {
    expect(selectUpdateRequired(withMinimum(17))).toBe(true);
  });

  it('is false at or above the minimum', () => {
    jest.mocked(readInstalledVersionCode).mockReturnValue(17);
    expect(selectUpdateRequired(withMinimum(17))).toBe(false);
  });

  it('fails open when the installed version cannot be read', () => {
    jest.mocked(readInstalledVersionCode).mockReturnValue(null);
    expect(selectUpdateRequired(withMinimum(17))).toBe(false);
  });

  it('does not read the installed version without a minimum', () => {
    expect(selectUpdateRequired(withMinimum(null))).toBe(false);
    expect(readInstalledVersionCode).not.toHaveBeenCalled();
  });

  it('is false on iOS and Web', () => {
    setOS('ios');
    expect(selectUpdateRequired(withMinimum(17))).toBe(false);
    setOS('web');
    expect(selectUpdateRequired(withMinimum(17))).toBe(false);
  });
});

describe('useUpdateRequired', () => {
  it('follows the store', async () => {
    const { result } = await renderHook(() => useUpdateRequired());
    expect(result.current).toBe(false);
    await act(async () => {
      useAppConfigStore.setState(withMinimum(17));
    });
    expect(result.current).toBe(true);
  });
});
