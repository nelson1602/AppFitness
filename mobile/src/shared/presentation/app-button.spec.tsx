import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { darkColors, lightColors } from '../theme/colors';
import { AppButton } from './app-button';

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
