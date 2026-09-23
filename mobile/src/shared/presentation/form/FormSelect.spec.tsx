import { fireEvent, render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { darkColors, lightColors } from '../../theme/colors';
import { FormSelect } from './FormSelect';

const OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
] as const;

/**
 * Real React Hook Form harness, so the selected arm under test is produced by
 * the shipped `Controller` path rather than by a stubbed field value.
 */
function Harness() {
  const { control } = useForm<{ gender: string }>({ defaultValues: { gender: 'female' } });
  return <FormSelect control={control} name="gender" label="Gender" options={OPTIONS} />;
}

const labelColorOf = (text: string): TextStyle['color'] =>
  StyleSheet.flatten(screen.getByText(text).props.style as StyleProp<TextStyle>)?.color;

const fillOf = (testID: string): ViewStyle['backgroundColor'] =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<ViewStyle>)
    ?.backgroundColor;

/** A two-letter option — the shape of the Spanish "Sí" that measured 39.6 dp wide. */
function ShortLabelHarness() {
  const { control } = useForm<{ answer: string }>({ defaultValues: { answer: 'no' } });
  return (
    <FormSelect
      control={control}
      name="answer"
      label="Evaluación"
      options={[
        { label: 'Sí', value: 'yes' },
        { label: 'No', value: 'no' },
      ]}
    />
  );
}

describe('FormSelect touch targets (BUG-023)', () => {
  it('gives every option, however short its label, at least a 48×48 target', async () => {
    await render(<ShortLabelHarness />);

    for (const testID of ['option-answer-yes', 'option-answer-no']) {
      const option = StyleSheet.flatten(
        screen.getByTestId(testID).props.style as StyleProp<ViewStyle>,
      );
      expect(option.minWidth).toBeGreaterThanOrEqual(48);
      expect(option.minHeight).toBeGreaterThanOrEqual(48);
      // The floor is added; the option's own padding is unchanged.
      expect(option.paddingHorizontal).toBe(12);
    }
  });

  it('keeps the options wrapping with the existing gap between targets', async () => {
    await render(<ShortLabelHarness />);

    const root = screen.root;
    if (root === null) throw new Error('FormSelect rendered no root');
    const [group] = root.queryAll(
      (node) =>
        node.type === 'View' &&
        StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>)?.flexWrap === 'wrap',
    );
    expect(StyleSheet.flatten(group?.props.style as StyleProp<ViewStyle>)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    });
    // Both options live inside that wrapping row.
    const ids = group?.queryAll((node) => typeof node.props.testID === 'string');
    expect(ids?.map((node) => node.props.testID)).toEqual(
      expect.arrayContaining(['option-answer-yes', 'option-answer-no']),
    );
  });
});

describe('FormSelect', () => {
  /**
   * ADR-P022 Addendum A, `.ai/08_UI_UX.md` §Usage-level contrast findings
   * (Finding 1). The selected chip fills with `primary` but rendered its label
   * through the default tone, which resolves to `onSurface`: 4.84:1 in light
   * (passing, which is why it survived review) and **1.42:1 in dark**. The
   * canonical filled pair is `primary` / `onPrimary` (ADR-P022 Decision 5a).
   *
   * Asserted on the resolved colour rather than the `tone` prop name, so a
   * rename cannot let the defect back in silently.
   */
  it('labels the selected chip with onPrimary, never onSurface', async () => {
    await render(<Harness />);

    expect([lightColors.primary, darkColors.primary]).toContain(fillOf('option-gender-female'));
    expect([lightColors.onPrimary, darkColors.onPrimary]).toContain(labelColorOf('Female'));
    expect([lightColors.onSurface, darkColors.onSurface]).not.toContain(labelColorOf('Female'));
  });

  it('keeps the unselected chip on the muted foreground over its recessed fill', async () => {
    await render(<Harness />);

    expect([lightColors.surfaceVariant, darkColors.surfaceVariant]).toContain(
      fillOf('option-gender-male'),
    );
    expect([lightColors.onSurfaceVariant, darkColors.onSurfaceVariant]).toContain(
      labelColorOf('Male'),
    );
  });

  /**
   * ADR-P022 Decision 7: selection is never carried by colour alone. The chip
   * exposes `accessibilityState.selected` and changes its border role, both of
   * which survive independently of the foreground correction above.
   */
  it('carries selection as programmatic state and a border change, not colour alone', async () => {
    await render(<Harness />);

    const selected = screen.getByTestId('option-gender-female');
    const unselected = screen.getByTestId('option-gender-male');

    expect(selected.props.accessibilityState?.selected).toBe(true);
    expect(unselected.props.accessibilityState?.selected).toBe(false);

    const borderOf = (node: typeof selected): ViewStyle['borderColor'] =>
      StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>)?.borderColor;
    expect(borderOf(selected)).not.toBe(borderOf(unselected));
  });

  it('moves the onPrimary label with the selection', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('option-gender-male'));

    expect([lightColors.onPrimary, darkColors.onPrimary]).toContain(labelColorOf('Male'));
    expect([lightColors.onSurfaceVariant, darkColors.onSurfaceVariant]).toContain(
      labelColorOf('Female'),
    );
  });

  it('exposes each chip with the radio role and a group-qualified name', async () => {
    await render(<Harness />);

    expect(screen.getByRole('radio', { name: 'Gender: Female' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Gender: Male' })).toBeOnTheScreen();
  });
});
