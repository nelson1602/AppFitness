import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet, Text, type ViewStyle } from 'react-native';

import SignInScreen from '@/app/sign-in';
import { Mascot } from '@/shared/presentation';

import {
  AUTH_COLUMN_MAX_WIDTH,
  AuthScreen,
  HERO_MIN_HEIGHT,
  useWebWindowHeight,
  webHeroMaxHeight,
} from './auth-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/features/authentication', () => ({
  AuthError: class MockAuthError extends Error {},
  signIn: jest.fn(),
  signUp: jest.fn(),
}));

/** The hero crop's ratio (941×515), as `Mascot` uses it. */
const HERO_RATIO = 941 / 515;

function styleOf(testID: string): ViewStyle {
  return (StyleSheet.flatten(
    screen.getByTestId(testID, { includeHiddenElements: true }).props.style,
  ) ?? {}) as ViewStyle;
}

let windowHeight = 720;
const listeners = new Set<() => void>();

beforeEach(() => {
  windowHeight = 720;
  listeners.clear();
  jest
    .spyOn(Dimensions, 'get')
    .mockImplementation(
      () => ({ width: 1280, height: windowHeight, scale: 1, fontScale: 1 }) as never,
    );
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation((_type, handler) => {
    const listener = handler as () => void;
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) } as never;
  });
});

afterEach(async () => {
  await act(async () => {});
  jest.restoreAllMocks();
});

describe('webHeroMaxHeight (Web sign-in fits a desktop window)', () => {
  it.each([
    // window, rest of the screen, expected band height
    [900, 0, 252], // not measured yet: about 28% of the window
    [900, 600, 252], // room for 300 px: still capped at 28%
    [720, 0, 202],
    [720, 540, 180], // the rest of the screen leaves 180 px
    [720, 600, HERO_MIN_HEIGHT], // never under 160 px: the screen scrolls instead
    [500, 0, HERO_MIN_HEIGHT],
  ])('window %i, rest %i → %i px', (window, rest, expected) => {
    expect(webHeroMaxHeight(window, rest)).toBe(expected);
  });
});

describe('useWebWindowHeight', () => {
  it('is null on native', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { result } = await renderHook(() => useWebWindowHeight());
    expect(result.current).toBeNull();
  });

  it('reads the window after mount on Web and follows resizes', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const { result } = await renderHook(() => useWebWindowHeight());
    expect(result.current).toBe(720);

    windowHeight = 900;
    await act(async () => listeners.forEach((listener) => listener()));
    expect(result.current).toBe(900);
  });
});

describe('AuthScreen', () => {
  it('centres the content in one column on the stage', async () => {
    await render(
      <AuthScreen>
        <Text>content</Text>
      </AuthScreen>,
    );

    expect(screen.getByTestId('screen-stage')).toBeOnTheScreen();
    // The host scroll view, the way screen.spec.tsx reads it.
    const scrollView = screen.root?.queryAll((node) => node.type === 'RCTScrollView')[0];
    const column = StyleSheet.flatten(scrollView?.props.contentContainerStyle) as ViewStyle;
    expect(column).toMatchObject({
      alignSelf: 'center',
      maxWidth: AUTH_COLUMN_MAX_WIDTH,
      width: '100%',
    });
    expect(AUTH_COLUMN_MAX_WIDTH).toBe(480);
  });
});

describe('Mascot hero height clamp', () => {
  it('stops growing past maxHeight, keeping the crop ratio and centring it', async () => {
    await render(<Mascot maxHeight={200} testID="hero" variant="hero" />);
    expect(styleOf('hero')).toMatchObject({ alignSelf: 'center', width: '100%' });
    expect(styleOf('hero').aspectRatio).toBeCloseTo(HERO_RATIO, 5);
    expect(styleOf('hero').maxWidth).toBeCloseTo(200 * HERO_RATIO, 5);
  });

  it('is unbounded without maxHeight (phones keep the full-width art)', async () => {
    await render(<Mascot testID="hero" variant="hero" />);
    expect(styleOf('hero').maxWidth).toBeUndefined();
  });
});

describe('Sign-in hero on Web', () => {
  it('gives up height to the rest of the screen so 1280×720 needs no scrolling', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await render(<SignInScreen />);

    // Before anything is measured, the 28% cap applies (720 → 202 px).
    expect(styleOf('sign-in-mascot').maxWidth).toBeCloseTo(202 * HERO_RATIO, 5);

    // The column is 740 px tall with a 160 px band: 580 px of other content
    // plus the 32 px of padding leaves 108 px, under the 160 px floor.
    await fireEvent(screen.getByTestId('sign-in-hero'), 'layout', {
      nativeEvent: { layout: { height: 160 } },
    });
    await fireEvent(screen.getByTestId('sign-in-content'), 'layout', {
      nativeEvent: { layout: { height: 740 } },
    });
    expect(styleOf('sign-in-mascot').maxWidth).toBeCloseTo(HERO_MIN_HEIGHT * HERO_RATIO, 5);

    // A taller window lets the band grow, back up to its 28% cap.
    windowHeight = 900;
    await act(async () => listeners.forEach((listener) => listener()));
    expect(styleOf('sign-in-mascot').maxWidth).toBeCloseTo(252 * HERO_RATIO, 5);
  });

  it('leaves the native hero full width', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<SignInScreen />);
    expect(styleOf('sign-in-mascot').maxWidth).toBeUndefined();
  });
});
