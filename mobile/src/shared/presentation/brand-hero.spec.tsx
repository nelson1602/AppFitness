import { render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { darkColors, lightColors } from '../theme';
import { BrandHero } from './brand-hero';

const flat = (testID: string) =>
  ReactNative.StyleSheet.flatten(
    screen.getByTestId(testID, { includeHiddenElements: true }).props.style,
  );

describe('BrandHero (ADR-P022 Addendum C)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('announces the product name once, as the header, and hides the artwork', async () => {
    await render(<BrandHero subtitle="Move with purpose" />);

    expect(screen.getByRole('header', { name: 'AppFitnessRD' })).toBeOnTheScreen();
    expect(screen.getAllByText('AppFitnessRD')).toHaveLength(1);
    expect(screen.getByText('Move with purpose')).toBeOnTheScreen();
    const mark = screen.getByTestId('brand-mark', { includeHiddenElements: true });
    expect(mark).toHaveProp('accessible', false);
    expect(mark).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(screen.queryByTestId('brand-mark')).toBeNull();
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)(
    'paints the %s identity gradient over a solid brand fallback',
    async (scheme, colors) => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
      await render(<BrandHero subtitle="Move with purpose" />);

      const hero = flat('brand-hero');
      expect(hero.backgroundColor).toBe(colors.brand);
      expect(hero.experimental_backgroundImage).toBe(
        `linear-gradient(135deg, ${colors.brand}, ${colors.brandEnd})`,
      );
      expect(screen.getByText('AppFitnessRD')).toHaveStyle({ color: colors.onBrand });
      expect(screen.getByText('Move with purpose')).toHaveStyle({ color: colors.onBrandVariant });
      expect(flat('brand-halo')).toEqual(
        expect.objectContaining({ backgroundColor: colors.brand, borderColor: colors.brandGlow }),
      );
    },
  );

  it('keeps the compact dashboard treatment smaller than the sign-in header', async () => {
    const view = await render(<BrandHero subtitle="Sign in" />);
    const regular = flat('brand-mark').width as number;

    await view.rerender(<BrandHero compact subtitle="Your local iCoach assessment" />);
    const compact = flat('brand-mark').width as number;

    expect(compact).toBeLessThan(regular);
    expect(regular).toBeLessThanOrEqual(64);
    expect(screen.getByRole('header', { name: 'AppFitnessRD' })).toBeOnTheScreen();
  });

  it('wraps long copy beside the mark instead of truncating it', async () => {
    await render(<BrandHero subtitle="Un subtítulo largo que debe poder ocupar varias líneas" />);

    const subtitle = screen.getByText('Un subtítulo largo que debe poder ocupar varias líneas');
    expect(subtitle.props.numberOfLines).toBeUndefined();
    expect(subtitle).toHaveProp('allowFontScaling', true);
  });
});
