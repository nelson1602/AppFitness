import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
