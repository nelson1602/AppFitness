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

  it('keeps font scaling enabled for accessibility', async () => {
    await render(<AppText>Scales</AppText>);

    expect(screen.getByText('Scales').props.allowFontScaling).toBe(true);
  });
});
