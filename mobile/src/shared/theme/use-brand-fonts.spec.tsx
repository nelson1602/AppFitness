import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { holdSplashForBrandFonts, useBrandFonts } from './use-brand-fonts';
import { FONT_ASSETS, FONT_FAMILY } from './fonts';
import { typography } from './typography';

const mockUseFonts = jest.fn<[boolean, Error | null], [unknown]>();
const mockPrevent = jest.fn(() => Promise.resolve(true));
const mockHide = jest.fn(() => Promise.resolve(true));
const mockLogError = jest.fn();

jest.mock('expo-font', () => ({ useFonts: (map: unknown) => mockUseFonts(map) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => mockPrevent(),
  hideAsync: () => mockHide(),
}));
jest.mock('@/shared/infrastructure/logging/logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

describe('brand fonts (ADR-P035 / ADR-P037)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads exactly the six bundled faces under their family names', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await renderHook(() => useBrandFonts());

    expect(mockUseFonts).toHaveBeenCalledWith(FONT_ASSETS);
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(FONT_FAMILY).sort());
  });

  it('sets every type token in a brand face and never sets a weight beside it', () => {
    for (const token of Object.values(typography)) {
      expect(Object.values(FONT_FAMILY)).toContain(token.fontFamily);
      expect(token).not.toHaveProperty('fontWeight');
    }
  });

  describe('native', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('holds the splash at load', () => {
      holdSplashForBrandFonts();
      expect(mockPrevent).toHaveBeenCalledTimes(1);
    });

    it('does not render until the faces settle, then releases the splash', async () => {
      mockUseFonts.mockReturnValue([false, null]);
      const view = await renderHook(() => useBrandFonts());
      expect(view.result.current).toBe(false);
      expect(mockHide).not.toHaveBeenCalled();

      mockUseFonts.mockReturnValue([true, null]);
      await view.rerender(undefined);
      expect(view.result.current).toBe(true);
      expect(mockHide).toHaveBeenCalledTimes(1);
    });

    it('logs a load failure and continues in the platform face', async () => {
      const failure = new Error('font missing');
      mockUseFonts.mockReturnValue([false, failure]);
      const view = await renderHook(() => useBrandFonts());

      expect(view.result.current).toBe(true);
      expect(mockLogError).toHaveBeenCalledWith('theme.fonts.load', failure);
      expect(mockHide).toHaveBeenCalledTimes(1);
    });
  });

  describe('web', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });

    it('never holds rendering, so the prerendered document has the real screen', async () => {
      mockUseFonts.mockReturnValue([false, null]);
      holdSplashForBrandFonts();
      const view = await renderHook(() => useBrandFonts());

      expect(view.result.current).toBe(true);
      expect(mockPrevent).not.toHaveBeenCalled();
      expect(mockHide).not.toHaveBeenCalled();
    });
  });
});
