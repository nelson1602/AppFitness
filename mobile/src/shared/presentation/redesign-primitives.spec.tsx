import { render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { darkColors, lightColors } from '../theme';
import { AppButton } from './app-button';
import { AppTextInput } from './app-text-input';
import { Chip } from './chip';
import { GlassCard } from './glass-card';
// The lint resolver maps each native/Web pair to the .web file; Jest loads each
// path as named, so both forms are under test.
// eslint-disable-next-line import/no-duplicates
import { GradientText } from './gradient-text';
// eslint-disable-next-line import/no-duplicates
import { GradientText as WebGradientText } from './gradient-text.web';
// eslint-disable-next-line import/no-duplicates
import { backgroundImageStyle, withAlpha } from './gradient-style';
// eslint-disable-next-line import/no-duplicates
import { backgroundImageStyle as webBackgroundImageStyle } from './gradient-style.web';
import { Icon } from './icon';
import { Mascot } from './mascot';
import { ProgressBar } from './progress-bar';
import { Pulse } from './pulse';
import { Ring } from './ring';
import { Screen } from './screen';
import { ctaBackgroundImage, stageBackgroundImage } from './stage-style';
import { AppText } from './app-text';

const flat = (testID: string) =>
  ReactNative.StyleSheet.flatten(
    screen.getByTestId(testID, { includeHiddenElements: true }).props.style,
  );

const useScheme = (scheme: 'light' | 'dark') =>
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);

describe('ADR-P035 redesign primitives', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('gradient and stage styles', () => {
    it('renders the same image natively and on Web, over the same solid fallback', () => {
      const image = 'linear-gradient(90deg, #000000, #FFFFFF)';
      expect(backgroundImageStyle(image, '#123456')).toEqual({
        backgroundColor: '#123456',
        experimental_backgroundImage: image,
      });
      expect(webBackgroundImageStyle(image, '#123456')).toEqual({
        backgroundColor: '#123456',
        backgroundImage: image,
      });
    });

    it('adds a clamped alpha channel to a token colour', () => {
      expect(withAlpha('#22D3EE', 0.16)).toBe('#22D3EE29');
      expect(withAlpha('#22D3EE', 2)).toBe('#22D3EEFF');
      expect(withAlpha('#22D3EE', -1)).toBe('#22D3EE00');
    });

    it.each([
      ['light', lightColors],
      ['dark', darkColors],
    ] as const)('builds the %s stage and CTA only from tokens', (_scheme, colors) => {
      const stage = stageBackgroundImage(colors);
      expect(stage.match(/gradient\(/g)).toHaveLength(4);
      for (const token of [colors.stage, colors.stageDeep, colors.stageMid, colors.stageTop]) {
        expect(stage).toContain(token);
      }
      expect(ctaBackgroundImage(colors)).toBe(
        `linear-gradient(90deg, ${colors.ctaStart}, ${colors.ctaEnd})`,
      );
    });
  });

  describe('AppButton (ADR-P035 D3)', () => {
    it.each([
      ['light', lightColors],
      ['dark', darkColors],
    ] as const)(
      'fills the %s primary CTA with the gradient and labels it onCta',
      async (scheme, colors) => {
        useScheme(scheme);
        await render(<AppButton testID="cta">Sign in</AppButton>);

        expect(flat('cta')).toEqual(
          expect.objectContaining({
            backgroundColor: colors.ctaStart,
            experimental_backgroundImage: ctaBackgroundImage(colors),
          }),
        );
        expect(screen.getByText('Sign in')).toHaveStyle({ color: colors.onCta });
      },
    );

    it('labels the stage variants with stage foregrounds and keeps the touch target', async () => {
      useScheme('dark');
      await render(
        <>
          <AppButton testID="secondary" variant="stage-secondary">
            Create an account
          </AppButton>
          <AppButton testID="link" variant="stage-link">
            Forgot it?
          </AppButton>
        </>,
      );

      expect(flat('secondary')).toEqual(
        expect.objectContaining({
          backgroundColor: darkColors.glassFill,
          borderColor: darkColors.glassBorder,
          minHeight: 44,
        }),
      );
      expect(screen.getByText('Create an account')).toHaveStyle({ color: darkColors.onStage });
      expect(screen.getByText('Forgot it?')).toHaveStyle({ color: darkColors.linkOnStage });
      expect(flat('link')).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    });
  });

  describe('AppTextInput stage appearance', () => {
    it('uses the stage field roles and leaves room for an icon and a toggle', async () => {
      useScheme('dark');
      await render(
        <AppTextInput
          accessibilityLabel="Email"
          appearance="stage"
          insetEnd={40}
          insetStart={30}
          onChangeText={jest.fn()}
          testID="field"
          value=""
        />,
      );

      const style = flat('field');
      expect(style).toEqual(
        expect.objectContaining({
          backgroundColor: darkColors.fieldFill,
          borderColor: darkColors.fieldIcon,
          color: darkColors.onField,
        }),
      );
      expect(style.paddingLeft).toBeGreaterThan(style.paddingHorizontal as number);
      expect(style.paddingRight).toBeGreaterThan(style.paddingHorizontal as number);
    });

    it('keeps the default appearance unchanged', async () => {
      useScheme('light');
      await render(
        <AppTextInput
          accessibilityLabel="Email"
          onChangeText={jest.fn()}
          testID="field"
          value=""
        />,
      );

      const style = flat('field');
      expect(style.backgroundColor).toBe(lightColors.surfaceVariant);
      expect(style).not.toHaveProperty('paddingLeft');
    });
  });

  it('paints the stage behind a Screen only when asked', async () => {
    useScheme('dark');
    const view = await render(
      <Screen stage>
        <AppText>Body</AppText>
      </Screen>,
    );
    expect(flat('screen-stage')).toEqual(
      expect.objectContaining({
        backgroundColor: darkColors.stage,
        experimental_backgroundImage: stageBackgroundImage(darkColors),
      }),
    );

    await view.rerender(
      <Screen>
        <AppText>Body</AppText>
      </Screen>,
    );
    expect(screen.queryByTestId('screen-stage')).toBeNull();
  });

  it('draws GlassCard as glass with no blur', async () => {
    useScheme('dark');
    await render(
      <GlassCard testID="glass">
        <AppText>Inside</AppText>
      </GlassCard>,
    );
    expect(flat('glass')).toEqual(
      expect.objectContaining({
        backgroundColor: darkColors.glassFill,
        borderColor: darkColors.glassBorder,
      }),
    );
  });

  it('names a Chip by its text and colours only its border and text by tone', async () => {
    useScheme('dark');
    await render(<Chip label="Today" testID="chip" tone="energy" />);
    expect(screen.getByText('Today')).toHaveStyle({ color: darkColors.accentEnergy });
    expect(flat('chip').borderColor).toBe(darkColors.accentEnergy);
  });

  describe('Ring and ProgressBar', () => {
    it('expose progress with a value and a text name, clamped to 0–100', async () => {
      await render(
        <>
          <Ring accessibilityLabel="3 of 4 workouts" value={0.75} />
          <ProgressBar accessibilityLabel="Weight goal" value={1.4} />
        </>,
      );

      const ring = screen.getByRole('progressbar', { name: '3 of 4 workouts' });
      expect(ring).toHaveProp('accessibilityValue', { min: 0, max: 100, now: 75 });
      const bar = screen.getByRole('progressbar', { name: 'Weight goal' });
      expect(bar).toHaveProp('accessibilityValue', { min: 0, max: 100, now: 100 });
      expect(flat('progress-bar-fill').width).toBe('100%');
    });

    it('treats a non-finite value as no progress', async () => {
      await render(<ProgressBar accessibilityLabel="Calories" value={Number.NaN} />);
      expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
        min: 0,
        max: 100,
        now: 0,
      });
    });
  });

  describe('Pulse (ADR-P035 D5)', () => {
    const reduceMotion = (value: boolean) =>
      jest.spyOn(ReactNative.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);

    it('sweeps the heartbeat once motion is allowed, hidden from assistive technology', async () => {
      reduceMotion(false);
      await render(<Pulse gradientId="pulse-test" />);
      expect(screen.queryByTestId('pulse')).toBeNull();
      expect(
        await screen.findByTestId('pulse-sweep', { includeHiddenElements: true }),
      ).toBeTruthy();
    });

    it('stays still until the preference is known, and under reduced motion', async () => {
      reduceMotion(true);
      await render(<Pulse gradientId="pulse-test" />);
      expect(screen.getByTestId('pulse-static', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByTestId('pulse-sweep', { includeHiddenElements: true })).toBeNull();
    });
  });

  describe('Mascot (ADR-P035 D6)', () => {
    it('is decorative unless it is given a name', async () => {
      const view = await render(<Mascot testID="hero" variant="hero" />);
      expect(screen.queryByTestId('hero')).toBeNull();
      expect(screen.getByTestId('hero-fade', { includeHiddenElements: true })).toBeTruthy();

      await view.rerender(<Mascot accessibilityLabel="AppFitnessRD mascot" variant="solo" />);
      expect(screen.getByRole('image', { name: 'AppFitnessRD mascot' })).toBeOnTheScreen();
    });

    it('keeps the approved hero crop ratio', async () => {
      await render(<Mascot testID="hero" variant="hero" />);
      expect(flat('hero').aspectRatio).toBeCloseTo(941 / 515, 5);
    });
  });

  describe('GradientText (ADR-P037 amendment)', () => {
    it('masks the gradient natively and hides both copies from assistive technology', async () => {
      await render(
        <GradientText end="#FF8A5B" start="#22D3EE" textStyle={{ fontSize: 28 }}>
          cuenta.
        </GradientText>,
      );
      expect(screen.queryByText('cuenta.')).toBeNull();
      expect(
        screen.getAllByText('cuenta.', { includeHiddenElements: true }).length,
      ).toBeGreaterThan(0);
    });

    it('falls back to solid cyan on Web, where masked text does not render', async () => {
      await render(
        <WebGradientText end="#FF8A5B" start="#22D3EE" textStyle={{ fontSize: 28 }}>
          cuenta.
        </WebGradientText>,
      );
      expect(screen.getByText('cuenta.', { includeHiddenElements: true })).toHaveStyle({
        color: '#22D3EE',
      });
    });
  });

  it('keeps an Icon hidden from assistive technology', async () => {
    await render(<Icon color="#000000" name="mail" testID="icon" />);
    expect(screen.queryByTestId('icon')).toBeNull();
    expect(screen.getByTestId('icon', { includeHiddenElements: true })).toBeTruthy();
  });
});
