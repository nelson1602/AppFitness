import { Linking } from 'react-native';

import { logWarn } from '@/shared/infrastructure/logging';

import {
  ANDROID_PACKAGE_FALLBACK,
  openStoreListing,
  parseVersionCode,
  readInstalledVersionCode,
} from './installed-app';

let mockNativeBuildVersion: string | null = null;
let mockApplicationId: string | null = null;

jest.mock('expo-application', () => ({
  __esModule: true,
  get nativeBuildVersion() {
    return mockNativeBuildVersion;
  },
  get applicationId() {
    return mockApplicationId;
  },
}));

jest.mock('@/shared/infrastructure/logging', () => ({ logWarn: jest.fn() }));

describe('parseVersionCode', () => {
  it('reads a positive integer string', () => {
    expect(parseVersionCode('17')).toBe(17);
    expect(parseVersionCode(' 9 ')).toBe(9);
  });

  it.each([null, undefined, '', 'abc', '0', '-3', '1.2', '17a', '99999999999999999999'])(
    'answers null for %p',
    (raw) => {
      expect(parseVersionCode(raw)).toBeNull();
    },
  );
});

describe('readInstalledVersionCode', () => {
  it('reads the native build version', () => {
    mockNativeBuildVersion = '17';
    expect(readInstalledVersionCode()).toBe(17);
  });

  it('answers null when the native build version is missing or unreadable', () => {
    mockNativeBuildVersion = null;
    expect(readInstalledVersionCode()).toBeNull();
    mockNativeBuildVersion = 'abc';
    expect(readInstalledVersionCode()).toBeNull();
  });
});

describe('openStoreListing', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    mockApplicationId = 'com.example.app';
    openURL = jest.spyOn(Linking, 'openURL');
    jest.mocked(logWarn).mockClear();
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('opens the Play Store app', async () => {
    openURL.mockResolvedValue(true);
    await openStoreListing();
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('market://details?id=com.example.app');
  });

  it('falls back to the web listing when no app handles market://', async () => {
    openURL.mockRejectedValueOnce(new Error('no handler')).mockResolvedValueOnce(true);
    await openStoreListing();
    expect(openURL).toHaveBeenNthCalledWith(
      2,
      'https://play.google.com/store/apps/details?id=com.example.app',
    );
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('uses the known package when the native module has no id, and logs a double failure', async () => {
    mockApplicationId = null;
    openURL.mockRejectedValue(new Error('no browser'));
    await expect(openStoreListing()).resolves.toBeUndefined();
    expect(openURL).toHaveBeenNthCalledWith(1, `market://details?id=${ANDROID_PACKAGE_FALLBACK}`);
    expect(logWarn).toHaveBeenCalledWith('appConfig.storeListing', 'Error');
  });
});
