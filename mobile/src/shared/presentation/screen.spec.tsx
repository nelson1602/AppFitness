import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { Keyboard, Platform, StyleSheet, type KeyboardEvent } from 'react-native';

import { AppText } from './app-text';
import { Screen } from './screen';

/**
 * `ScrollView` reaches the host tree as `RCTScrollView`; asserting the host
 * node is what lets these tests read the props React Native actually applied.
 */
function scrollViews() {
  const root = screen.root;
  if (root === null) throw new Error('Screen rendered no root');
  return root.queryAll((node) => node.type === 'RCTScrollView');
}

describe('Screen', () => {
  it('renders children inside a scrollable container by default', async () => {
    await render(
      <Screen>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );

    expect(screen.getByText('Scrollable content')).toBeOnTheScreen();
  });

  it('renders a plain flex view when scroll is disabled (forms)', async () => {
    await render(
      <Screen scroll={false}>
        <AppText>Fixed content</AppText>
      </Screen>,
    );

    expect(screen.getByText('Fixed content')).toBeOnTheScreen();
  });

  /**
   * BUG-021. React Native's default is `"never"`, under which the first tap on
   * a control is spent dismissing an open keyboard instead of activating it —
   * so Save had to be tapped twice after typing on every scrollable form.
   *
   * This asserts the **prop**, which is all a component test can observe:
   * `jest-expo` has no keyboard, so the tap-consumption behaviour itself is
   * device-only and is not claimed here.
   */
  it('lets a tap reach a control while the keyboard is open', async () => {
    await render(
      <Screen>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );

    const [scrollView] = scrollViews();
    expect(scrollView?.props.keyboardShouldPersistTaps).toBe('handled');
  });

  // The fixed branch must stay a plain View: adding a ScrollView here would
  // change layout and reintroduce scrolling on screens that deliberately have
  // none.
  it('creates no ScrollView when scroll is disabled', async () => {
    await render(
      <Screen scroll={false}>
        <AppText>Fixed content</AppText>
      </Screen>,
    );

    expect(scrollViews()).toHaveLength(0);
  });

  it('merges a caller style after the default content style', async () => {
    await render(
      <Screen style={{ padding: 7 }}>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );

    const [scrollView] = scrollViews();
    expect(StyleSheet.flatten(scrollView?.props.contentContainerStyle)).toMatchObject({
      padding: 7,
    });
  });
});

/**
 * BUG-022. On Android the keyboard covers the bottom of the scroll view, so the
 * last content (typically Save) could never be scrolled above it. `Screen` adds
 * that much scroll room while the keyboard is shown. These tests drive the real
 * `Keyboard` subscription with captured listeners; they prove the clearance and
 * its lifecycle, not the on-device result, which the emulator run covers.
 */
describe('Screen keyboard clearance (BUG-022)', () => {
  type Listener = (event: KeyboardEvent) => void;
  let listeners: Record<string, Listener>;
  let removals: jest.Mock[];

  const keyboardEvent = (height: number) =>
    ({ endCoordinates: { height, screenX: 0, screenY: 0, width: 0 } }) as KeyboardEvent;

  function clearanceSpacers() {
    const root = screen.root;
    if (root === null) throw new Error('Screen rendered no root');
    return root.queryAll(
      (node) =>
        node.type === 'View' &&
        node.props.pointerEvents === 'none' &&
        node.props.importantForAccessibility === 'no-hide-descendants',
    );
  }

  const spacerHeight = () => StyleSheet.flatten(clearanceSpacers()[0]?.props.style)?.height;

  async function emit(eventName: string, height = 0) {
    await act(async () => {
      listeners[eventName]?.(keyboardEvent(height));
    });
  }

  beforeEach(() => {
    listeners = {};
    removals = [];
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, listener) => {
      listeners[eventName] = listener as Listener;
      const remove = jest.fn();
      removals.push(remove);
      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderScrollable() {
    await render(
      <Screen>
        <AppText>Scrollable content</AppText>
      </Screen>,
    );
  }

  it('adds no clearance until the keyboard is shown', async () => {
    await renderScrollable();

    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));
    expect(clearanceSpacers()).toHaveLength(0);
  });

  it('adds exactly the reported keyboard height as scroll clearance', async () => {
    await renderScrollable();

    await emit('keyboardDidShow', 300);

    expect(clearanceSpacers()).toHaveLength(1);
    expect(spacerHeight()).toBe(300);
  });

  it('rounds a fractional height up so the last point stays clear', async () => {
    await renderScrollable();

    await emit('keyboardDidShow', 312.4);

    expect(spacerHeight()).toBe(313);
  });

  it('follows a keyboard height change while it stays open', async () => {
    await renderScrollable();

    await emit('keyboardDidShow', 250);
    await emit('keyboardDidShow', 312);

    expect(spacerHeight()).toBe(312);
  });

  it('does not re-render when the effective height is unchanged', async () => {
    const onRender = jest.fn();
    await render(
      <Profiler id="screen" onRender={onRender}>
        <Screen>
          <AppText>Scrollable content</AppText>
        </Screen>
      </Profiler>,
    );
    await emit('keyboardDidShow', 300.2);
    const commitsAfterFirstShow = onRender.mock.calls.length;

    // 300.2 and 300.9 both round up to 301: no effective change.
    await emit('keyboardDidShow', 300.9);
    await emit('keyboardDidShow', 300.2);

    expect(spacerHeight()).toBe(301);
    expect(onRender).toHaveBeenCalledTimes(commitsAfterFirstShow);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -40, 0])(
    'treats a reported height of %p as no clearance',
    async (height) => {
      await renderScrollable();

      await emit('keyboardDidShow', height);

      expect(clearanceSpacers()).toHaveLength(0);
    },
  );

  it('removes the clearance when the keyboard hides', async () => {
    await renderScrollable();
    await emit('keyboardDidShow', 300);

    await emit('keyboardDidHide');

    expect(clearanceSpacers()).toHaveLength(0);
  });

  it('starts from the open keyboard when mounted while it is shown', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ height: 280, screenX: 0, screenY: 0, width: 0 });

    await renderScrollable();

    expect(spacerHeight()).toBe(280);
  });

  it('removes both keyboard listeners on unmount', async () => {
    await renderScrollable();
    expect(removals).toHaveLength(2);

    await act(async () => {
      screen.unmount();
    });

    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the clearance hidden from assistive technology and transparent to touches', async () => {
    await renderScrollable();
    await emit('keyboardDidShow', 300);

    const [spacer] = clearanceSpacers();
    expect(spacer?.props.accessibilityElementsHidden).toBe(true);
    expect(spacer?.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(spacer?.props.pointerEvents).toBe('none');
    expect(spacer?.props.accessible).not.toBe(true);
  });

  it('keeps taps reaching controls while the clearance is applied', async () => {
    await renderScrollable();
    await emit('keyboardDidShow', 300);

    const [scrollView] = scrollViews();
    expect(scrollView?.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it.each(['ios', 'web'] as const)(
    'subscribes to nothing and adds no clearance on %s',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);

      await renderScrollable();

      expect(Keyboard.addListener).not.toHaveBeenCalled();
      expect(clearanceSpacers()).toHaveLength(0);
    },
  );

  it('subscribes to nothing and adds no clearance when scroll is disabled', async () => {
    await render(
      <Screen scroll={false}>
        <AppText>Fixed content</AppText>
      </Screen>,
    );

    expect(Keyboard.addListener).not.toHaveBeenCalled();
    expect(clearanceSpacers()).toHaveLength(0);
    expect(scrollViews()).toHaveLength(0);
  });
});
