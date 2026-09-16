import { render, screen } from '@testing-library/react-native';

import { darkColors, lightColors } from '../theme/colors';
import { AppText } from './app-text';

describe('AppText', () => {
  it('renders its children as accessible text', async () => {
    await render(<AppText>Hello AppFitness</AppText>);

    expect(screen.getByText('Hello AppFitness')).toBeOnTheScreen();
  });

  it('applies the tone color from the theme', async () => {
    await render(<AppText tone="error">Problem</AppText>);

    const flattened = Object.assign(
      {},
      ...[screen.getByText('Problem').props.style].flat(Infinity),
    ) as { color?: string };
    expect([lightColors.error, darkColors.error]).toContain(flattened.color);
  });

  /**
   * ADR-P022 Addendum A. `onPrimary` is the label tone for text sitting on a
   * `primary` fill. Asserting it resolves to the `onPrimary` token — and, in
   * particular, never to `onSurface` — is what stops the four selected chips
   * regressing to the 1.42:1 dark-theme pairing they shipped with.
   */
  it('resolves the onPrimary tone to the onPrimary token, never onSurface', async () => {
    await render(<AppText tone="onPrimary">Selected</AppText>);

    const flattened = Object.assign(
      {},
      ...[screen.getByText('Selected').props.style].flat(Infinity),
    ) as { color?: string };

    expect([lightColors.onPrimary, darkColors.onPrimary]).toContain(flattened.color);
    expect([lightColors.onSurface, darkColors.onSurface]).not.toContain(flattened.color);
  });

  it('keeps font scaling enabled for accessibility', async () => {
    await render(<AppText>Scales</AppText>);

    expect(screen.getByText('Scales').props.allowFontScaling).toBe(true);
  });
});
