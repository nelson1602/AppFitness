import { render, screen } from '@testing-library/react-native';

import { BrandHero } from './brand-hero';

describe('BrandHero', () => {
  it('shows the product identity and keeps the artwork decorative', async () => {
    await render(<BrandHero subtitle="Move with purpose" />);

    expect(screen.getByText('AppFitnessRD')).toBeOnTheScreen();
    expect(screen.getByText('Move with purpose')).toBeOnTheScreen();
    expect(screen.getByTestId('brand-mark', { includeHiddenElements: true })).toHaveProp(
      'accessible',
      false,
    );
  });

  it('supports the compact dashboard treatment without changing the name', async () => {
    await render(<BrandHero compact subtitle="Your local iCoach assessment" />);

    expect(screen.getByTestId('brand-hero')).toBeOnTheScreen();
    expect(screen.getByText('AppFitnessRD')).toBeOnTheScreen();
  });
});
