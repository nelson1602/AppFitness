import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type View,
  type ViewStyle,
} from 'react-native';

import { darkColors, lightColors } from '../theme/colors';
import { AppButton } from './app-button';
import { PaidWriteDisabledProvider } from './paid-write-context';

function labelColorOf(text: string): TextStyle['color'] {
  return StyleSheet.flatten(screen.getByText(text).props.style as StyleProp<TextStyle>)?.color;
}

describe('AppButton', () => {
  it('renders its label with the button accessibility role', async () => {
    await render(<AppButton onPress={jest.fn()}>Sync now</AppButton>);

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeOnTheScreen();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<AppButton onPress={onPress}>Tap me</AppButton>);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks presses and shows a spinner while loading', async () => {
    const onPress = jest.fn();
    await render(
      <AppButton loading onPress={onPress}>
        Saving
      </AppButton>,
    );

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState?.disabled).toBe(true);
  });

  /**
   * BUG-020. While `loading`, the visible label is replaced by a spinner. The
   * accessible name must survive that swap — otherwise the three auth submit
   * buttons (`sign-in`, `forgot-password`, `reset-password`) become a button
   * with a role and no name at the exact moment they are working.
   *
   * The query is by **role and name together**: a `getByText` would pass on a
   * label that is no longer the button's accessible name, which is the very
   * regression this guards.
   */
  it('keeps its accessible name while loading', async () => {
    await render(
      <AppButton loading onPress={jest.fn()}>
        Sign in
      </AppButton>,
    );

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.queryByText('Sign in')).toBeNull(); // the spinner replaced it
  });

  it('exposes busy and disabled while loading', async () => {
    await render(
      <AppButton loading onPress={jest.fn()}>
        Saving
      </AppButton>,
    );

    const state = screen.getByRole('button').props.accessibilityState;
    expect(state?.busy).toBe(true);
    expect(state?.disabled).toBe(true);
  });

  it('is named but not busy when idle', async () => {
    await render(<AppButton onPress={jest.fn()}>Save</AppButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeOnTheScreen();
    expect(button.props.accessibilityState?.busy).toBe(false);
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  // Several callers pass a longer, more descriptive name than the visible text;
  // deriving a name from children must never overwrite it.
  it('prefers an explicit accessibilityLabel over the child text', async () => {
    await render(
      <AppButton loading accessibilityLabel="Delete account permanently" onPress={jest.fn()}>
        Delete
      </AppButton>,
    );

    expect(screen.getByRole('button', { name: 'Delete account permanently' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  // The component owns `disabled`/`busy`; everything else belongs to the caller
  // and must pass through untouched.
  it('merges caller accessibilityState instead of replacing it', async () => {
    await render(
      <AppButton accessibilityState={{ selected: true, expanded: false }} onPress={jest.fn()}>
        Filters
      </AppButton>,
    );

    const state = screen.getByRole('button').props.accessibilityState;
    expect(state?.selected).toBe(true);
    expect(state?.expanded).toBe(false);
    expect(state?.busy).toBe(false);
  });

  /**
   * The component-owned fields are applied last, so a caller cannot announce
   * "idle and enabled" while `AppButton` is actually blocking presses — the
   * announcement would contradict the behaviour.
   */
  it('does not let a caller falsify the owned disabled and busy state', async () => {
    const onPress = jest.fn();
    await render(
      <AppButton loading accessibilityState={{ disabled: false, busy: false }} onPress={onPress}>
        Saving
      </AppButton>,
    );

    const state = screen.getByRole('button').props.accessibilityState;
    expect(state?.disabled).toBe(true);
    expect(state?.busy).toBe(true);

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks presses when explicitly disabled', async () => {
    const onPress = jest.fn();
    await render(
      <AppButton disabled onPress={onPress}>
        Nope
      </AppButton>,
    );

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks paid writes from the shared entitlement boundary', async () => {
    const onPress = jest.fn();
    await render(
      <PaidWriteDisabledProvider disabled>
        <AppButton onPress={onPress}>Save</AppButton>
      </PaidWriteDisabledProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState?.disabled).toBe(true);
  });

  it('allows an explicit nested read-only navigation control', async () => {
    const onPress = jest.fn();
    await render(
      <PaidWriteDisabledProvider disabled>
        <PaidWriteDisabledProvider disabled={false}>
          <AppButton onPress={onPress}>View saved data</AppButton>
        </PaidWriteDisabledProvider>
      </PaidWriteDisabledProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'View saved data' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('supports all variants without crashing', async () => {
    for (const variant of ['primary', 'secondary', 'text', 'destructive'] as const) {
      await render(
        <AppButton variant={variant} onPress={jest.fn()}>
          {variant}
        </AppButton>,
      );
      expect(screen.getByText(variant)).toBeOnTheScreen();
    }
  });

  /**
   * ADR-P022 Addendum A. A filled variant's label is the `on*` foreground of
   * the role it is filled with. `destructive` fills with `error` but borrowed
   * `onPrimary`, which is `#FFFFFF` in the light theme (so the defect was
   * invisible there) and the dark theme's blue `#06345C` — a blue label on a
   * red button. The assertion is on the resolved colour, not the prop name, so
   * a rename cannot hide a regression.
   */
  it('labels the destructive variant with onError, never onPrimary', async () => {
    await render(
      <AppButton variant="destructive" onPress={jest.fn()}>
        Delete account
      </AppButton>,
    );

    expect([lightColors.onError, darkColors.onError]).toContain(labelColorOf('Delete account'));
    expect([darkColors.onPrimary]).not.toContain(labelColorOf('Delete account'));
  });

  it('labels the primary variant with onPrimary', async () => {
    await render(<AppButton onPress={jest.fn()}>Save</AppButton>);

    expect([lightColors.onPrimary, darkColors.onPrimary]).toContain(labelColorOf('Save'));
  });

  // The unfilled variants sit on a surface, so they keep the `primary` tone
  // rather than an `on*` foreground — asserted so the change above cannot
  // spread to them.
  it.each(['secondary', 'text'] as const)(
    'labels the %s variant with the primary tone',
    async (variant) => {
      await render(
        <AppButton variant={variant} onPress={jest.fn()}>
          Later
        </AppButton>,
      );

      expect([lightColors.primary, darkColors.primary]).toContain(labelColorOf('Later'));
    },
  );

  // A short label whose text alone would be well under 44px — the touch target
  // must still be >= 44x44 for every variant, critically the bare `text` one
  // (.ai/08_UI_UX.md "Minimum touch target: 44 x 44").
  it.each(['primary', 'secondary', 'text', 'destructive'] as const)(
    'enforces the 44x44 minimum touch target for the %s variant',
    async (variant) => {
      await render(
        <AppButton variant={variant} onPress={jest.fn()}>
          X
        </AppButton>,
      );
      // Pressable style is a function (receives { pressed }); flatten its output.
      const styleProp = screen.getByRole('button').props.style as unknown;
      const resolved =
        typeof styleProp === 'function'
          ? (styleProp as (s: { pressed: boolean }) => StyleProp<ViewStyle>)({ pressed: false })
          : (styleProp as StyleProp<ViewStyle>);
      const flat = StyleSheet.flatten(resolved) ?? {};
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
      expect(flat.minWidth).toBeGreaterThanOrEqual(44);
    },
  );
});

// BUG-035 (owner Option 1). On Web a disabled button becomes a native
// `<button disabled>`, which drops keyboard focus mid-request. A Web button that
// is only loading therefore stays enabled but withholds every press handler and
// exposes busy; explicit and paid-write disabling are unchanged.
// The DOM result (`aria-busy="true"`, no `disabled`/`aria-disabled`, focus kept)
// was verified in headless Chrome. Prop evidence only here.
//
// BUG-037 extends the same contract to Android, where a disabled state becomes
// `View.setEnabled(false)` and focus jumps to the first focusable view. iOS
// loading stays genuinely disabled. Focus retention was verified with TalkBack.
describe('AppButton loading contract (BUG-035, BUG-037)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const host = () => screen.getByTestId('btn');

  // Fires the host's real Pressability click handler (what a DOM click, Enter or
  // Space reaches on Web). `fireEvent.press` is not used here: with no handler
  // on the Pressable it walks up to AppButton's own props and calls the caller's
  // callback directly, which no runtime path does.
  const clickHost = () =>
    host().props.onClick?.({
      nativeEvent: {},
      persist() {},
      preventDefault() {},
      stopPropagation() {},
    });

  it('keeps a loading Web button enabled and busy, and its activation inert', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onPress = jest.fn();
    const view = await render(
      <AppButton onPress={onPress} testID="btn">
        Send reset link
      </AppButton>,
    );
    clickHost();
    expect(onPress).toHaveBeenCalledTimes(1); // the path is live when not loading

    await view.rerender(
      <AppButton loading onPress={onPress} testID="btn">
        Send reset link
      </AppButton>,
    );
    expect(host()).not.toBeDisabled();
    expect(host().props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: false }),
    );
    clickHost();
    clickHost();
    expect(onPress).toHaveBeenCalledTimes(1);
    // The name survives the spinner (BUG-020).
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBe(host());
  });

  it('restores the press handler on Web once loading ends', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onPress = jest.fn();
    const view = await render(
      <AppButton loading onPress={onPress} testID="btn">
        Send
      </AppButton>,
    );
    await view.rerender(
      <AppButton onPress={onPress} testID="btn">
        Send
      </AppButton>,
    );

    clickHost();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(host().props.accessibilityState).toEqual(
      expect.objectContaining({ busy: false, disabled: false }),
    );
  });

  it.each(['web', 'ios', 'android'] as const)(
    'keeps an explicitly disabled loading button genuinely disabled on %s',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      const onPress = jest.fn();
      await render(
        <AppButton disabled loading onPress={onPress} testID="btn">
          Save
        </AppButton>,
      );

      expect(host()).toBeDisabled();
      expect(host().props.accessibilityState).toEqual(
        expect.objectContaining({ busy: true, disabled: true }),
      );
      await fireEvent.press(host());
      expect(onPress).not.toHaveBeenCalled();
    },
  );

  it.each(['web', 'ios', 'android'] as const)(
    'keeps a paid-write-disabled loading button genuinely disabled on %s',
    async (os) => {
      jest.replaceProperty(Platform, 'OS', os);
      const onPress = jest.fn();
      await render(
        <PaidWriteDisabledProvider disabled>
          <AppButton loading onPress={onPress} testID="btn">
            Save
          </AppButton>
        </PaidWriteDisabledProvider>,
      );

      expect(host()).toBeDisabled();
      expect(host().props.accessibilityState).toEqual(
        expect.objectContaining({ busy: true, disabled: true }),
      );
      await fireEvent.press(host());
      expect(onPress).not.toHaveBeenCalled();
    },
  );

  it('keeps iOS loading truly disabled', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onPress = jest.fn();
    await render(
      <AppButton loading onPress={onPress} testID="btn">
        Save
      </AppButton>,
    );

    expect(host()).toBeDisabled();
    expect(host().props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
    await fireEvent.press(host());
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('on Android (BUG-037)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    // A touch on the host's real Pressability responder: grant, hold, release.
    // A hold past the long-press delay (500 ms) is a long press.
    const touchEvent = () => ({
      currentTarget: { measure() {} },
      nativeEvent: {
        changedTouches: [],
        identifier: 0,
        locationX: 0,
        locationY: 0,
        pageX: 0,
        pageY: 0,
        target: 0,
        timestamp: 0,
        touches: [],
      },
      persist() {},
      preventDefault() {},
      stopPropagation() {},
    });
    const touchHost = async (holdMs: number) => {
      const props = host().props;
      await act(async () => {
        props.onResponderGrant?.(touchEvent());
        jest.advanceTimersByTime(holdMs);
        props.onResponderRelease?.(touchEvent());
        jest.advanceTimersByTime(1000);
      });
    };
    const opacityOf = (pressed: boolean) => {
      const style = host().props.style as unknown;
      const resolved =
        typeof style === 'function'
          ? (style as (s: { pressed: boolean }) => StyleProp<ViewStyle>)({ pressed })
          : (style as StyleProp<ViewStyle>);
      return StyleSheet.flatten(resolved)?.opacity;
    };

    it('keeps a loading Android button enabled, focusable, busy and named', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(
        <AppButton loading onPress={jest.fn()} testID="btn">
          Sign in
        </AppButton>,
      );

      expect(host()).not.toBeDisabled();
      expect(host().props.focusable).toBe(true);
      // What TalkBack reads: an accessible button, busy and not disabled.
      expect(host().props.accessible).toBe(true);
      expect(host().props.accessibilityRole).toBe('button');
      expect(host().props.accessibilityState).toEqual(
        expect.objectContaining({ busy: true, disabled: false }),
      );
      // Touch exploration must still find it: no pointer-events gating.
      expect(host().props.pointerEvents).toBeUndefined();
      expect(host().props['aria-busy']).toBeUndefined(); // a Web-only attribute
      expect(screen.getByRole('button', { name: 'Sign in' })).toBe(host());
      expect(screen.queryByText('Sign in')).toBeNull(); // the spinner replaced it
      // Still visibly unavailable, with no pressed feedback.
      expect(opacityOf(false)).toBe(0.56);
      expect(opacityOf(true)).toBe(0.56);
    });

    it('withholds every activation handler on Android while loading', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      jest.useFakeTimers();
      const handlers = {
        onLongPress: jest.fn(),
        onPress: jest.fn(),
        onPressIn: jest.fn(),
        onPressOut: jest.fn(),
      };
      const calls = () => Object.values(handlers).map((fn) => fn.mock.calls.length);
      const view = await render(
        <AppButton {...handlers} testID="btn">
          Sign in
        </AppButton>,
      );

      // Control: each path is live when not loading.
      clickHost(); // keyboard activation and TalkBack double-tap reach onClick
      await touchHost(0);
      await touchHost(800);
      expect(calls()).toEqual([1, 2, 2, 2]);

      await view.rerender(
        <AppButton {...handlers} loading testID="btn">
          Sign in
        </AppButton>,
      );
      clickHost();
      clickHost();
      await touchHost(0);
      await touchHost(800);
      expect(calls()).toEqual([1, 2, 2, 2]);

      // Activation returns once loading ends.
      await view.rerender(
        <AppButton {...handlers} testID="btn">
          Sign in
        </AppButton>,
      );
      clickHost();
      expect(handlers.onPress).toHaveBeenCalledTimes(3);
      expect(host().props.accessibilityState).toEqual(
        expect.objectContaining({ busy: false, disabled: false }),
      );
    });

    // Records every caller callback, in order.
    const recorder = () => {
      const log: string[] = [];
      const handlers = {
        onLongPress: jest.fn(() => log.push('longPress')),
        onPress: jest.fn(() => log.push('press')),
        onPressIn: jest.fn(() => log.push('pressIn')),
        onPressOut: jest.fn(() => log.push('pressOut')),
      };
      return { handlers, log };
    };

    // The straddle: Pressability completes a press with the handlers current
    // at release, so a touch that began while loading would otherwise submit
    // again once loading clears (the reverted first candidate).
    // A press of 130 ms or more calls onPressOut before onPress, and one past
    // 500 ms without onLongPress still presses: both must stay blocked.
    it.each([
      ['a quick tap', 50, 50, true],
      ['a 200 ms press', 100, 100, true],
      ['a long hold', 200, 700, true],
      ['a long hold without onLongPress', 200, 700, false],
    ])(
      'ignores %s that began while loading and ends after it clears',
      async (_kind, beforeClear, afterClear, withLong) => {
        jest.replaceProperty(Platform, 'OS', 'android');
        jest.useFakeTimers();
        const { handlers: all, log } = recorder();
        const { onLongPress, ...rest } = all;
        const handlers = { ...rest, onLongPress: withLong ? onLongPress : undefined };
        const view = await render(
          <AppButton {...handlers} loading testID="btn">
            Sign in
          </AppButton>,
        );

        await act(async () => {
          host().props.onResponderGrant?.(touchEvent());
          jest.advanceTimersByTime(beforeClear);
        });
        await view.rerender(
          <AppButton {...handlers} testID="btn">
            Sign in
          </AppButton>,
        );
        await act(async () => {
          jest.advanceTimersByTime(afterClear);
          host().props.onResponderRelease?.(touchEvent());
          jest.advanceTimersByTime(1000);
        });
        expect(log).toEqual([]);

        // The next fresh idle press works normally.
        await touchHost(0);
        expect(log).toEqual(['pressIn', 'press', 'pressOut']);
      },
    );

    it('does not let a cancelled blocked touch block the next click or touch', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      jest.useFakeTimers();
      const { handlers, log } = recorder();
      const view = await render(
        <AppButton {...handlers} loading testID="btn">
          Sign in
        </AppButton>,
      );
      await act(async () => {
        host().props.onResponderGrant?.(touchEvent());
      });
      await view.rerender(
        <AppButton {...handlers} testID="btn">
          Sign in
        </AppButton>,
      );
      await act(async () => {
        host().props.onResponderTerminate?.(touchEvent()); // e.g. a scroll took over
        jest.advanceTimersByTime(1000);
      });
      expect(log).toEqual([]);

      // Keyboard and TalkBack activation carry no touch sequence of their own.
      clickHost();
      expect(log).toEqual(['press']);
      await touchHost(0);
      expect(log).toEqual(['press', 'pressIn', 'press', 'pressOut']);
    });

    // iOS is the unchanged reference: idle Android must call the caller's
    // callbacks in exactly the same order, with and without `onLongPress`.
    it.each([
      ['a quick tap', 0, true],
      ['a 200 ms press', 200, true],
      ['a long press', 800, true],
      ['a long hold without onLongPress', 800, false],
    ])('keeps idle callback order for %s identical to iOS', async (_kind, holdMs, withLong) => {
      jest.useFakeTimers();
      const run = async (os: 'ios' | 'android') => {
        jest.replaceProperty(Platform, 'OS', os);
        const { handlers, log } = recorder();
        const { onLongPress, ...rest } = handlers;
        const view = await render(
          <AppButton {...rest} onLongPress={withLong ? onLongPress : undefined} testID="btn">
            Sign in
          </AppButton>,
        );
        await touchHost(holdMs);
        if (os === 'android') clickHost(); // Android's keyboard/TalkBack path
        await view.unmount();
        return log;
      };
      const ios = await run('ios');
      const android = await run('android');
      expect(ios.length).toBeGreaterThan(0);
      expect(android).toEqual([...ios, 'press']);
    });
  });

  it('forwards its ref to the underlying Pressable host', async () => {
    const ref = createRef<View>();
    await render(
      <AppButton onPress={() => {}} ref={ref} testID="btn">
        Go
      </AppButton>,
    );

    // The ref is the Pressable's host view: it carries the button's own testID
    // and role, and exposes `focus` (used for success focus on Web).
    const target = ref.current as unknown as {
      props: { testID?: string; accessibilityRole?: string };
      focus?: unknown;
    };
    expect(target.props.testID).toBe('btn');
    expect(target.props.accessibilityRole).toBe('button');
    expect(typeof target.focus).toBe('function');
  });
});
