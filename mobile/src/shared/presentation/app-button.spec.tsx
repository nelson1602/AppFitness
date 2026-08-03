import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppButton } from './app-button';

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
