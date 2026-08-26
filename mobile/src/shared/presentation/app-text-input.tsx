import { useState } from 'react';
import {
  TextInput,
  type NativeSyntheticEvent,
  type TextInputEndEditingEventData,
} from 'react-native';

import { useTheme } from '../theme';

/**
 * Border widths are local, non-exported implementation constants. The accepted
 * token set contains no border-width scale (`shared/theme` exposes spacing and
 * radius only), and adding one would be a token decision that is out of scope
 * for UX-1C-1 — see `.ai/08_UI_UX.md` §Non-colour redundancy, which requires a
 * focused border "visibly thicker than the default 1 px" and deliberately
 * leaves the value unspecified.
 */
const BORDER_WIDTH = 1;
const FOCUSED_BORDER_WIDTH = 2;

/**
 * Disabled is de-emphasised with opacity, never with a semantic colour role
 * alone, matching the shipped `AppButton` treatment.
 */
const DISABLED_OPACITY = 0.56;

/** The four keyboard types with shipped evidence. No others are accepted. */
type AppTextInputKeyboardType = 'default' | 'numeric' | 'decimal-pad' | 'email-address';

interface AppTextInputBaseProps {
  /**
   * The control's accessible name. Required: it lands on the native
   * `TextInput` node alongside `testID` and the value, because shipped specs
   * resolve inputs by label and then assert `testID` / `.props.value` on the
   * same node (`.ai/08_UI_UX.md` §Input frozen-hook register).
   */
  accessibilityLabel: string;
  testID?: string;
  placeholder?: string;
  keyboardType?: AppTextInputKeyboardType;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  selectTextOnFocus?: boolean;
  onBlur?: () => void;
  /**
   * Prevents interaction (`editable={false}`), exposes the condition
   * programmatically, and de-emphasises the control without relying on colour
   * alone. Supported on iOS, Android and Web.
   */
  disabled?: boolean;
}

/** Controlled: the caller owns the value and receives every change. */
interface AppTextInputControlledProps {
  value: string;
  onChangeText: (next: string) => void;
  defaultValue?: never;
  onCommitEnd?: never;
}

/**
 * Uncontrolled commit-on-end: the caller seeds an initial value and receives
 * the final string once, when editing ends. Deliberately narrow — it exists
 * only for the shipped per-set reps editor and must not be widened into a
 * general uncontrolled API. `defaultValue` does not re-synchronise, matching
 * the shipped behaviour that consumer relies on.
 */
interface AppTextInputCommitOnEndProps {
  defaultValue: string;
  onCommitEnd: (committed: string) => void;
  value?: never;
  onChangeText?: never;
}

/**
 * The two control models are mutually exclusive: the `never` members make a
 * mixed or partial pair unassignable even when props flow through a variable,
 * where excess-property checking would not apply.
 */
export type AppTextInputProps = AppTextInputBaseProps &
  (AppTextInputControlledProps | AppTextInputCommitOnEndProps);

/**
 * Theme-aware single-line text control (UX-1C-1, `.ai/08_UI_UX.md` §1
 * `AppTextInput`). It owns the native input node, the two control models, the
 * FULL-family visual tokens, its focused state, disabled behaviour, and its
 * accessible name.
 *
 * It owns no visible label, helper text, validation message, required
 * indication, schema, or form controller — those stay with the caller.
 *
 * `required` and `invalid` are deliberately **absent** from this API: on
 * `react-native@0.86.2` / `react-native-web@0.21.2` / `expo@57.0.13` there is
 * no supported typed mechanism to expose either as state on native iOS or
 * Android, so a prop would be inert there (ADR-P023 Decision 5). The whole
 * invalid state — visual border included — belongs to UX-1C-2, once the
 * mandatory accessibility follow-up defines a truthful semantic interface.
 * This is a staged partial implementation, not the complete contract.
 *
 * There is no catch-all prop spread: an arbitrary `TextInputProps` surface
 * would silently reintroduce every API the contract rejects, and would let a
 * caller disable font scaling.
 */
export function AppTextInput(props: AppTextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const {
    accessibilityLabel,
    testID,
    placeholder,
    keyboardType,
    secureTextEntry,
    autoCapitalize,
    autoCorrect,
    selectTextOnFocus,
    onBlur,
    disabled = false,
  } = props;

  // Neither native event shape reaches the caller: the commit callback
  // receives the committed string, and blur is a plain notification.
  const model =
    props.defaultValue !== undefined
      ? {
          defaultValue: props.defaultValue,
          onEndEditing: (event: NativeSyntheticEvent<TextInputEndEditingEventData>) =>
            props.onCommitEnd(event.nativeEvent.text),
        }
      : { value: props.value, onChangeText: props.onChangeText };

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      allowFontScaling
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      editable={disabled ? false : undefined}
      keyboardType={keyboardType}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      onFocus={() => setFocused(true)}
      placeholder={placeholder}
      // `outline` must never carry placeholder text — that pairing is a
      // measured light-theme contrast failure.
      placeholderTextColor={theme.colors.onSurfaceVariant}
      secureTextEntry={secureTextEntry}
      selectTextOnFocus={selectTextOnFocus}
      testID={testID}
      style={{
        backgroundColor: theme.colors.surfaceVariant,
        borderColor: theme.colors.outline,
        borderRadius: theme.radius.medium,
        borderWidth: focused ? FOCUSED_BORDER_WIDTH : BORDER_WIDTH,
        color: theme.colors.onSurface,
        // A floor that grows with the OS text scale, never a ceiling.
        minHeight: theme.spacing.x5l,
        opacity: disabled ? DISABLED_OPACITY : 1,
        paddingHorizontal: theme.spacing.md,
        ...theme.typography.body,
      }}
      {...model}
    />
  );
}
