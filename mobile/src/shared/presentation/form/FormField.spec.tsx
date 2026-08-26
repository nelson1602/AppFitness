import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { Pressable, Text, type TextStyle } from 'react-native';
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
});
