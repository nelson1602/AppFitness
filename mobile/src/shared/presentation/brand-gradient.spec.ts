import { darkColors, lightColors } from '../theme';
// The lint resolver maps both paths to the .web file; Jest loads each as named.
// eslint-disable-next-line import/no-duplicates
import { brandGradientStyle as nativeGradient } from './brand-gradient';
// eslint-disable-next-line import/no-duplicates
import { brandGradientStyle as webGradient } from './brand-gradient.web';

// ADR-P022 Addendum C: one visual intention, two renderers. Native uses React
// Native's `experimental_backgroundImage`; react-native-web does not implement
// it, so Web uses CSS `backgroundImage`. Both keep the solid `brand` fallback.
describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('identity gradient (%s)', (_scheme, colors) => {
  const gradient = `linear-gradient(135deg, ${colors.brand}, ${colors.brandEnd})`;

  it('renders natively over a solid fallback', () => {
    expect(nativeGradient(colors)).toEqual({
      backgroundColor: colors.brand,
      experimental_backgroundImage: gradient,
    });
  });

  it('renders the same gradient on Web over the same fallback', () => {
    expect(webGradient(colors)).toEqual({
      backgroundColor: colors.brand,
      backgroundImage: gradient,
    });
  });
});
