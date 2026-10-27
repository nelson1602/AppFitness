import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatNumber, interpolate, useLocalization } from '@/shared/localization';
import { AppText, AppTextInput, Chip, Icon, withAlpha } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

/**
 * The Evaluación física's stage controls, after the prototype's `Choice`,
 * option rows, `Group` and `NumField`. Every control is at least 48 dp tall
 * and shows its selection with a check mark and a border, never by colour
 * alone; the state also reaches assistive technology.
 */

interface ChoiceProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` for one-of, `checkbox` for many. */
  role: 'radio' | 'checkbox';
  accessibilityLabel?: string;
  testID: string;
  /** Stretch to share a row (grid choices). */
  grow?: boolean;
}

export function Choice({
  label,
  selected,
  onPress,
  role,
  accessibilityLabel,
  testID,
  grow,
}: ChoiceProps) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.center,
        styles.row,
        {
          backgroundColor: selected
            ? colors.accentCyan
            : withAlpha(colors.onStage, pressed ? 0.12 : 0.06),
          borderColor: selected ? colors.onStage : withAlpha(colors.onStage, 0.3),
          borderRadius: theme.radius.field,
          borderWidth: selected ? 2 : 1,
          flexGrow: grow ? 1 : 0,
          flexBasis: grow ? 0 : 'auto',
          gap: theme.spacing.xs,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
      ]}
      testID={testID}
    >
      {selected ? <Icon color={colors.stageDeep} name="check" size={14} strokeWidth={3} /> : null}
      <AppText style={{ color: selected ? colors.stageDeep : colors.onStage }} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

interface OptionRowProps {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  role: 'radio' | 'checkbox';
  testID: string;
}

/** A full-width option with a second line, as the activity and injury lists. */
export function OptionRow({ title, detail, selected, onPress, role, testID }: OptionRowProps) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? withAlpha(colors.accentCyan, 0.16)
            : withAlpha(colors.onStage, pressed ? 0.1 : 0.04),
          borderColor: selected ? colors.accentCyan : withAlpha(colors.onStage, 0.18),
          borderRadius: theme.radius.large,
          borderWidth: selected ? 2 : 1,
          gap: theme.spacing.md,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
      ]}
      testID={testID}
    >
      <View style={styles.grow}>
        <AppText tone="onStage" variant="label">
          {title}
        </AppText>
        {detail ? (
          <AppText tone="onStageVariant" variant="caption">
            {detail}
          </AppText>
        ) : null}
      </View>
      <View
        style={[
          styles.center,
          {
            backgroundColor: selected ? colors.accentCyan : 'transparent',
            borderColor: selected ? colors.accentCyan : withAlpha(colors.onStage, 0.4),
            borderRadius: role === 'radio' ? theme.radius.full : theme.radius.small,
            borderWidth: 2,
            height: 24,
            width: 24,
          },
        ]}
      >
        {selected ? <Icon color={colors.stageDeep} name="check" size={14} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

interface GroupProps {
  title: string;
  count: number;
  children: ReactNode;
  testID: string;
  initiallyOpen?: boolean;
}

/** A collapsible group with the number of marked options in its header. */
export function Group({ title, count, children, testID, initiallyOpen = false }: GroupProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { language, t } = useLocalization();
  const [open, setOpen] = useState(initiallyOpen);
  const marked =
    count === 1
      ? t('evaluation.group.markedOne')
      : interpolate(t('evaluation.group.markedMany'), { n: formatNumber(count, language) });
  return (
    <View
      style={{
        backgroundColor: withAlpha(colors.onStage, 0.05),
        borderColor: withAlpha(colors.onStage, 0.15),
        borderRadius: theme.radius.large,
        borderWidth: 1,
        overflow: 'hidden',
      }}
      testID={testID}
    >
      <Pressable
        accessibilityHint={t('evaluation.group.expandHint')}
        accessibilityLabel={count > 0 ? `${title}, ${marked}` : title}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? withAlpha(colors.onStage, 0.06) : 'transparent',
            gap: theme.spacing.sm,
            minHeight: theme.spacing.x5l,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
        testID={`${testID}-toggle`}
      >
        <AppText style={styles.shrink} tone="onStage" variant="label">
          {title}
        </AppText>
        {count > 0 ? <Chip label={marked} testID={`${testID}-count`} tone="cyan" /> : null}
        <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
          <Icon color={colors.onStage} name="chevron" size={18} />
        </View>
      </Pressable>
      {open ? (
        <View
          style={{
            borderColor: withAlpha(colors.onStage, 0.1),
            borderTopWidth: 1,
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

interface NumberFieldProps {
  label: string;
  unit: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  testID: string;
}

/** A labelled decimal field on the stage with its unit inside the field. */
export function NumberField({ label, unit, value, onChangeText, error, testID }: NumberFieldProps) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={[styles.grow, { gap: theme.spacing.xs, minWidth: 140 }]}>
      <AppText tone="onStage" variant="label">
        {label}
      </AppText>
      <View>
        <AppTextInput
          accessibilityLabel={`${label} (${unit})`}
          appearance="stage"
          insetEnd={theme.spacing.x4l}
          keyboardType="decimal-pad"
          onChangeText={onChangeText}
          testID={testID}
          value={value}
        />
        <View pointerEvents="none" style={[styles.unit, { right: theme.spacing.md }]}>
          <AppText style={{ color: colors.fieldIcon }} variant="label">
            {unit}
          </AppText>
        </View>
      </View>
      {error ? (
        <AppText testID={`${testID}-error`} tone="errorOnStage" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

interface StepperProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  lessLabel: string;
  moreLabel: string;
  testID: string;
}

/** A − value + control; the app ships no slider (no new dependency). */
export function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  lessLabel,
  moreLabel,
  testID,
}: StepperProps) {
  const theme = useTheme();
  const { colors } = theme;
  const button = (sign: -1 | 1) => {
    const next = Math.round((value + sign * step) * 10) / 10;
    const disabled = sign < 0 ? value <= min : value >= max;
    return (
      <Pressable
        accessibilityLabel={sign < 0 ? lessLabel : moreLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(Math.min(max, Math.max(min, next)))}
        style={({ pressed }) => [
          styles.center,
          {
            backgroundColor: withAlpha(colors.onStage, pressed ? 0.16 : 0.08),
            borderRadius: theme.radius.full,
            minHeight: theme.spacing.x5l,
            minWidth: theme.spacing.x5l,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
        testID={`${testID}-${sign < 0 ? 'less' : 'more'}`}
      >
        <AppText tone="onStage" variant="title">
          {sign < 0 ? '−' : '+'}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText tone="onStage" variant="label">
        {label}
      </AppText>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        {button(-1)}
        <AppText
          accessibilityLabel={`${label}: ${display}`}
          align="center"
          style={[styles.grow, { color: colors.accentCyan }]}
          testID={testID}
          variant="title"
        >
          {display}
        </AppText>
        {button(1)}
      </View>
    </View>
  );
}

/** Small section heading with an optional hint below it. */
export function Legend({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText accessibilityRole="header" tone="onStage" variant="label">
        {children}
      </AppText>
      {hint ? (
        <AppText tone="onStageVariant" variant="caption">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  shrink: { flexGrow: 1, flexShrink: 1 },
  row: { alignItems: 'center', flexDirection: 'row' },
  unit: { bottom: 0, justifyContent: 'center', position: 'absolute', top: 0 },
});
