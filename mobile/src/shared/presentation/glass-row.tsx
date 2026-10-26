import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

interface GlassRowProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** A short second line (status, value); part of the row's spoken name. */
  detail?: string;
  /** A small status label on the right, e.g. "Pendiente". */
  badge?: string;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * One navigation row on the stage (ADR-P039): icon, label, optional detail and
 * badge, and a chevron. Replaces the old stacks of full-width buttons on the
 * tabs. The whole row is the target (at least 48 px tall) and is named by its
 * text, so the icon and chevron stay decorative.
 */
export function GlassRow({
  label,
  icon,
  onPress,
  detail,
  badge,
  accessibilityLabel,
  testID,
}: GlassRowProps) {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const name = accessibilityLabel ?? [label, detail, badge].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.glassBorder : 'transparent',
          borderRadius: radius.field,
          gap: spacing.md,
          minHeight: theme.spacing.x5l,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
        },
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor: colors.glassFill,
            borderRadius: radius.full,
            height: spacing.x4l,
            width: spacing.x4l,
          },
        ]}
      >
        <Icon color={colors.accentCyan} name={icon} size={18} />
      </View>
      <View style={[styles.text, { gap: spacing.xs }]}>
        <AppText tone="onStage" variant="label">
          {label}
        </AppText>
        {detail ? (
          <AppText tone="onStageVariant" variant="caption">
            {detail}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <View
          style={{
            backgroundColor: colors.glassFill,
            borderColor: colors.accentEnergy,
            borderRadius: radius.full,
            borderWidth: 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
          }}
        >
          <AppText tone="onStage" variant="caption">
            {badge}
          </AppText>
        </View>
      ) : null}
      <Icon color={colors.onStageVariant} name="chevron" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    flex: 1,
  },
});
