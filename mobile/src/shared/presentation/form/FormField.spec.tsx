import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { Platform, Pressable, Text, type TextStyle } from 'react-native';
import { z } from 'zod';

import { darkColors, lightColors } from '../../theme/colors';
import { FormField } from './FormField';

const ERROR_MESSAGE = 'Enter a name';

const schema = z.object({ name: z.string().min(1, ERROR_MESSAGE) });

/**
 * Real React Hook Form harness: a genuine `useForm` + `zodResolver`, so the
 * error state under test is produced by the shipped validation path rather than
 * by a stubbed `fieldState`.
 */
function Harness() {
  const { control, handleSubmit } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  return (
    <>
      <FormField control={control} name="name" label="Name" required />
      <Pressable accessibilityRole="button" onPress={() => void handleSubmit(() => {})()}>
        <Text>Save</Text>
      </Pressable>
    </>
  );
}

const flattenStyle = (node: { props: { style?: unknown } }): TextStyle =>
  Object.assign({}, ...[node.props.style].flat(Infinity)) as TextStyle;

const submit = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
};

describe('FormField', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the validation message once, carrying aria-live="polite"', async () => {
    await render(<Harness />);
    await submit();

    await waitFor(() => expect(screen.getByText(ERROR_MESSAGE)).toBeOnTheScreen());

    // Rendered exactly once — no duplicated error copy.
    expect(screen.getAllByText(ERROR_MESSAGE)).toHaveLength(1);
    // Prop-presence evidence only. This asserts that the message node requests a
    // polite announcement; it is NOT evidence that TalkBack or a browser screen
    // reader announced anything, and it says nothing about iOS, where React
    // Native does not implement `aria-live`. Those outcomes require manual
    // verification (.ai/08_UI_UX.md §Verification expectations).
    expect(screen.getByText(ERROR_MESSAGE)).toHaveProp('aria-live', 'polite');
  });

  it('renders no message node while the field is valid', async () => {
    await render(<Harness />);

    expect(screen.queryByText(ERROR_MESSAGE)).toBeNull();

    await fireEvent.changeText(screen.getByTestId('field-name'), 'Squat');
    await submit();

    await waitFor(() => expect(screen.queryByText(ERROR_MESSAGE)).toBeNull());
  });

  it('keeps the accessible label and testID on the native input', async () => {
    await render(<Harness />);

    expect(screen.getByLabelText('Name')).toHaveProp('testID', 'field-name');
    expect(screen.getByTestId('field-name').props.value).toBe('');
  });

  it('keeps the error-coloured border on the input when invalid', async () => {
    await render(<Harness />);

    const outlineBorder = flattenStyle(screen.getByTestId('field-name')).borderColor;
    expect([lightColors.outline, darkColors.outline]).toContain(outlineBorder);

    await submit();
    await waitFor(() => expect(screen.getByText(ERROR_MESSAGE)).toBeOnTheScreen());

    const invalidBorder = flattenStyle(screen.getByTestId('field-name')).borderColor;
    expect([lightColors.error, darkColors.error]).toContain(invalidBorder);
  });

  describe('Android error announcement (BUG-034)', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    const liveNodes = () =>
      screen.container.queryAll(
        (node) =>
          typeof node.type === 'string' &&
          (node.props?.['aria-live'] !== undefined ||
            node.props?.accessibilityLiveRegion !== undefined),
      );

    it('keeps one empty, zero-height live text mounted while the field is valid', async () => {
      await render(<Harness />);

      const live = liveNodes();
      expect(live).toHaveLength(1);
      expect(live[0]).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(live[0]).toHaveTextContent('');
      expect(flattenStyle(live[0]).height).toBe(0);
    });

    it('writes the message into that same live text, once, when the field becomes invalid', async () => {
      await render(<Harness />);
      const before = liveNodes()[0];

      await submit();
      await waitFor(() => expect(screen.getByText(ERROR_MESSAGE)).toBeOnTheScreen());

      const after = liveNodes();
      expect(after).toHaveLength(1);
      expect(after[0]).toBe(before);
      expect(after[0]).toHaveTextContent(ERROR_MESSAGE);
      expect(flattenStyle(after[0]).height).toBeUndefined();
      expect(screen.getAllByText(ERROR_MESSAGE)).toHaveLength(1);
      // `aria-live` is inert on Android `Text`, so it is not used there.
      expect(after[0].props['aria-live']).toBeUndefined();
    });
  });

  it('keeps the Web announcement on the message alone, only while invalid', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await render(<Harness />);

    expect(
      screen.container.queryAll((node) => node.props?.accessibilityLiveRegion !== undefined),
    ).toHaveLength(0);
    expect(screen.container.queryAll((node) => node.props?.['aria-live'] !== undefined)).toEqual(
      [],
    );

    await submit();
    await waitFor(() => expect(screen.getByText(ERROR_MESSAGE)).toHaveProp('aria-live', 'polite'));
  });

  describe('programmatic name (BUG-033)', () => {
    function TwoFields() {
      const { control } = useForm<{ weight: string; notes: string }>({
        defaultValues: { weight: '', notes: '' },
      });
      return (
        <>
          <FormField
            control={control}
            name="weight"
            label="Weight (kg)"
            placeholder="e.g. 80.5"
            required
          />
          <FormField control={control} name="notes" label="Notes" placeholder="Anything" />
        </>
      );
    }

    // Owner Option B: on Android the visible label is the only name. The native
    // node carries no `accessibilityLabel`, which TalkBack read as text on an
    // empty field without a placeholder, speaking the label twice (TalkBack-
    // verified in EN/ES after the change: once in every state).
    function States() {
      const { control } = useForm<{ weight: string; height: string; target: string }>({
        defaultValues: { weight: '', height: '', target: '72' },
      });
      return (
        <>
          <FormField
            control={control}
            name="weight"
            label="Weight (kg)"
            placeholder="e.g. 80.5"
            required
          />
          <FormField control={control} name="height" label="Height (cm)" required />
          <FormField control={control} name="target" label="Target weight (kg)" />
        </>
      );
    }

    it.each([
      ['empty with a placeholder', 'field-weight', 'Weight (kg) *'],
      ['empty without a placeholder', 'field-height', 'Height (cm) *'],
      ['filled', 'field-target', 'Target weight (kg)'],
    ])('names an Android field %s by its visible label only', async (_state, testID, visible) => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<States />);

      const input = screen.getByTestId(testID);
      expect(input.props.accessibilityLabelledBy).toEqual(expect.any(String));
      expect(input.props.accessibilityLabel).toBeUndefined();
      // The visible label, required marker unchanged, is the linked node.
      expect(screen.getByText(visible)).toHaveProp('nativeID', input.props.accessibilityLabelledBy);
      expect(screen.getByLabelText(visible)).toBe(input);
    });

    it('never names an Android field by its placeholder or value, and links distinct labels', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<States />);

      expect(screen.queryByLabelText('e.g. 80.5')).toBeNull();
      expect(screen.queryByLabelText('72')).toBeNull();
      expect(screen.getByTestId('field-target').props.value).toBe('72');
      const ids = ['field-weight', 'field-height', 'field-target'].map(
        (id) => screen.getByTestId(id).props.accessibilityLabelledBy,
      );
      expect(new Set(ids).size).toBe(3);
    });

    it.each(['ios', 'web'] as const)(
      'adds no label link on %s, which keeps accessibilityLabel',
      async (os) => {
        jest.replaceProperty(Platform, 'OS', os);
        await render(<TwoFields />);

        const weight = screen.getByTestId('field-weight');
        expect(weight.props.accessibilityLabelledBy).toBeUndefined();
        expect(screen.getByText('Weight (kg) *').props.nativeID).toBeUndefined();
        expect(weight).toHaveProp('accessibilityLabel', 'Weight (kg)');
      },
    );
  });
});
