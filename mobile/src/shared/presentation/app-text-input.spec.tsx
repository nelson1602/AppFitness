import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TextStyle } from 'react-native';

import { darkColors, lightColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { AppTextInput, type AppTextInputProps } from './app-text-input';

/**
 * Type-level proof that the two control models are mutually exclusive. These
 * aliases compile only while each shape is genuinely unassignable to
 * `AppTextInputProps`, so `tsc --noEmit` fails if the union is ever weakened.
 * No suppression comment is involved — a suppression would pass silently once
 * the error disappeared, which is the opposite of a proof.
 */
type Expect<T extends true> = T;
type Rejected<T> = T extends AppTextInputProps ? false : true;

type MixedModel = {
  accessibilityLabel: string;
  value: string;
  onChangeText: (next: string) => void;
  defaultValue: string;
  onCommitEnd: (committed: string) => void;
};
type PartialControlled = { accessibilityLabel: string; value: string };
type PartialCommitOnEnd = { accessibilityLabel: string; defaultValue: string };
type ControlledWithCommit = {
  accessibilityLabel: string;
  value: string;
  onChangeText: (next: string) => void;
  onCommitEnd: (committed: string) => void;
};

type MixedIsRejected = Expect<Rejected<MixedModel>>;
type PartialControlledIsRejected = Expect<Rejected<PartialControlled>>;
type PartialCommitOnEndIsRejected = Expect<Rejected<PartialCommitOnEnd>>;
type ControlledWithCommitIsRejected = Expect<Rejected<ControlledWithCommit>>;

/** Both models remain expressible — the union must not over-reject either. */
type ControlledIsAccepted = Expect<Rejected<AppTextInputProps> extends true ? false : true>;

const flattenStyle = (node: { props: { style?: unknown } }): TextStyle =>
  Object.assign({}, ...[node.props.style].flat(Infinity)) as TextStyle;

describe('AppTextInput', () => {
  it('holds the accessible name, testID and value on the same native node', async () => {
    await render(
      <AppTextInput
        accessibilityLabel="Email"
        testID="input-email"
        value="user@appfitness.local"
        onChangeText={jest.fn()}
      />,
    );

    const node = screen.getByLabelText('Email');
    expect(node).toHaveProp('testID', 'input-email');
    expect(node.props.value).toBe('user@appfitness.local');
    expect(screen.getByTestId('input-email').props.value).toBe('user@appfitness.local');
  });

  describe('controlled model', () => {
    it('renders the value and reports every change', async () => {
      const onChangeText = jest.fn();
      await render(
        <AppTextInput
          accessibilityLabel="Email"
          testID="input-email"
          value="a@b.c"
          onChangeText={onChangeText}
        />,
      );

      expect(screen.getByTestId('input-email').props.value).toBe('a@b.c');

      await fireEvent.changeText(screen.getByTestId('input-email'), 'next@b.c');

      expect(onChangeText).toHaveBeenCalledTimes(1);
      expect(onChangeText).toHaveBeenCalledWith('next@b.c');
    });

    it('does not seed an uncontrolled default value', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Email"
          testID="input-email"
          value="a@b.c"
          onChangeText={jest.fn()}
        />,
      );

      expect(screen.getByTestId('input-email').props.defaultValue).toBeUndefined();
      expect(screen.getByTestId('input-email').props.onEndEditing).toBeUndefined();
    });
  });

  describe('uncontrolled commit-on-end model', () => {
    it('renders defaultValue and commits the final string once on end-edit', async () => {
      const onCommitEnd = jest.fn();
      await render(
        <AppTextInput
          accessibilityLabel="Reps for set 1"
          testID="set-reps-1"
          defaultValue="10"
          onCommitEnd={onCommitEnd}
        />,
      );

      const node = screen.getByTestId('set-reps-1');
      expect(node.props.defaultValue).toBe('10');
      expect(node.props.value).toBeUndefined();

      await fireEvent(node, 'endEditing', { nativeEvent: { text: '12' } });

      expect(onCommitEnd).toHaveBeenCalledTimes(1);
      // The caller receives the committed string, never the native event.
      expect(onCommitEnd).toHaveBeenCalledWith('12');
    });

    it('exposes no live onChangeText callback, so keystrokes do not commit', async () => {
      const onCommitEnd = jest.fn();
      await render(
        <AppTextInput
          accessibilityLabel="Reps for set 1"
          testID="set-reps-1"
          defaultValue="10"
          onCommitEnd={onCommitEnd}
        />,
      );

      expect(screen.getByTestId('set-reps-1').props.onChangeText).toBeUndefined();
      expect(onCommitEnd).not.toHaveBeenCalled();
    });
  });

  describe('input configuration pass-through', () => {
    it.each(['default', 'numeric', 'decimal-pad', 'email-address'] as const)(
      'passes the %s keyboard type to the native node',
      async (keyboardType) => {
        await render(
          <AppTextInput
            accessibilityLabel="Field"
            testID="field"
            keyboardType={keyboardType}
            value=""
            onChangeText={jest.fn()}
          />,
        );

        expect(screen.getByTestId('field')).toHaveProp('keyboardType', keyboardType);
      },
    );

    it('masks secure entry', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Password"
          testID="input-password"
          secureTextEntry
          value="secret"
          onChangeText={jest.fn()}
        />,
      );

      expect(screen.getByTestId('input-password')).toHaveProp('secureTextEntry', true);
    });

    it('passes capitalization, correction and selectTextOnFocus through', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Phrase"
          testID="input-confirm-phrase"
          autoCapitalize="characters"
          autoCorrect={false}
          selectTextOnFocus
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('input-confirm-phrase');
      expect(node).toHaveProp('autoCapitalize', 'characters');
      expect(node).toHaveProp('autoCorrect', false);
      expect(node).toHaveProp('selectTextOnFocus', true);
    });

    it('leaves unset configuration to the platform default', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('field');
      expect(node.props.autoCapitalize).toBeUndefined();
      expect(node.props.autoCorrect).toBeUndefined();
      expect(node.props.keyboardType).toBeUndefined();
      expect(node.props.secureTextEntry).toBeUndefined();
    });

    it('renders the placeholder in the on-surface-variant role, never outline', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Search"
          testID="field"
          placeholder="Search foods"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('field');
      expect(node).toHaveProp('placeholder', 'Search foods');
      expect([lightColors.onSurfaceVariant, darkColors.onSurfaceVariant]).toContain(
        node.props.placeholderTextColor,
      );
      expect([lightColors.outline, darkColors.outline]).not.toContain(
        node.props.placeholderTextColor,
      );
    });
  });

  describe('focus', () => {
    it('renders a 1 px border by default and a thicker one while focused', async () => {
      const onBlur = jest.fn();
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
          onBlur={onBlur}
        />,
      );

      expect(flattenStyle(screen.getByTestId('field')).borderWidth).toBe(1);

      await fireEvent(screen.getByTestId('field'), 'focus');
      const focusedWidth = flattenStyle(screen.getByTestId('field')).borderWidth ?? 0;
      expect(focusedWidth).toBeGreaterThan(1);

      await fireEvent(screen.getByTestId('field'), 'blur');
      expect(flattenStyle(screen.getByTestId('field')).borderWidth).toBe(1);
    });

    it('still calls an external blur callback alongside internal focus tracking', async () => {
      const onBlur = jest.fn();
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
          onBlur={onBlur}
        />,
      );

      await fireEvent(screen.getByTestId('field'), 'focus');
      await fireEvent(screen.getByTestId('field'), 'blur');

      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(flattenStyle(screen.getByTestId('field')).borderWidth).toBe(1);
    });

    it('does not require an external blur callback', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      await fireEvent(screen.getByTestId('field'), 'focus');
      await fireEvent(screen.getByTestId('field'), 'blur');

      expect(flattenStyle(screen.getByTestId('field')).borderWidth).toBe(1);
    });
  });

  describe('disabled', () => {
    it('prevents editing and exposes the condition programmatically', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          disabled
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('field');
      expect(node).toHaveProp('editable', false);
      expect(node.props.accessibilityState?.disabled).toBe(true);
    });

    it('de-emphasises without relying on a semantic colour role alone', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          disabled
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const disabled = flattenStyle(screen.getByTestId('field'));
      expect(disabled.opacity).toBeLessThan(1);
      // The colour roles are unchanged — opacity is the redundant signal.
      expect([lightColors.onSurface, darkColors.onSurface]).toContain(disabled.color);
    });

    it('leaves an enabled control free of both disabled props', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('field');
      expect(node.props.editable).toBeUndefined();
      expect(node.props.accessibilityState).toBeUndefined();
      expect(flattenStyle(node).opacity).toBe(1);
    });
  });

  describe('tokens, dynamic type and staged scope', () => {
    it('uses the FULL input family from the active theme', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const style = flattenStyle(screen.getByTestId('field'));
      expect([lightColors.surfaceVariant, darkColors.surfaceVariant]).toContain(
        style.backgroundColor,
      );
      expect([lightColors.onSurface, darkColors.onSurface]).toContain(style.color);
      expect([lightColors.outline, darkColors.outline]).toContain(style.borderColor);
      expect(style.borderRadius).toBe(radius.medium);
      expect(style.paddingHorizontal).toBe(spacing.md);
    });

    it('sets a height floor rather than a fixed height, and keeps font scaling on', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      const node = screen.getByTestId('field');
      const style = flattenStyle(node);
      expect(style.minHeight).toBe(spacing.x5l);
      expect(style.height).toBeUndefined();
      // `allowFontScaling` is not part of the public surface and there is no
      // catch-all spread, so a caller cannot switch it off.
      expect(node.props.allowFontScaling).toBe(true);
    });

    it('publishes no required or invalid state in this staged slice', async () => {
      await render(
        <AppTextInput
          accessibilityLabel="Field"
          testID="field"
          value=""
          onChangeText={jest.fn()}
        />,
      );

      // UX-1C-1 exposes neither, by design (ADR-P023 Decision 5): there is no
      // supported typed native mechanism, so no prop, style branch, or hidden
      // path may imply one. The whole invalid state belongs to UX-1C-2.
      // These assertions record absence — they say nothing about VoiceOver,
      // TalkBack or browser-AT behaviour, which no Jest assertion can prove.
      const node = screen.getByTestId('field');
      expect(node.props.accessibilityState).toBeUndefined();
      expect(node.props['aria-invalid']).toBeUndefined();
      expect(node.props['aria-required']).toBeUndefined();
      expect([lightColors.error, darkColors.error]).not.toContain(
        flattenStyle(node).borderColor as string,
      );
    });

    it('keeps the control-model type union closed', () => {
      // Compile-time proof; asserted here so the aliases are exercised by the
      // suite as well as by `tsc --noEmit`.
      const mixedRejected: MixedIsRejected = true;
      const partialControlledRejected: PartialControlledIsRejected = true;
      const partialCommitRejected: PartialCommitOnEndIsRejected = true;
      const controlledWithCommitRejected: ControlledWithCommitIsRejected = true;
      const bothModelsAccepted: ControlledIsAccepted = true;

      expect([
        mixedRejected,
        partialControlledRejected,
        partialCommitRejected,
        controlledWithCommitRejected,
        bothModelsAccepted,
      ]).toEqual([true, true, true, true, true]);
    });
  });
});
