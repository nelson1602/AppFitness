import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { interpolate, useLocalization } from '@/shared/localization';
import { AppButton, AppText, GlassCard, Icon } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { countUnsyncedChanges, signOutAndEraseThisPhone } from '../application/erase-device-data';

/**
 * Sign out and erase this phone's data (ADR-P047 D4). A plain sign-out keeps
 * the local database for the next sign-in (ADR-P030 Decision 8); this row is
 * the explicit alternative for a shared or handed-on phone. It asks once,
 * says how many changes have not synced yet, and only then erases. The
 * session guard returns to sign-in afterwards, as with a plain sign-out.
 */
export function EraseDeviceDataRow() {
  const theme = useTheme();
  const { colors, radius, spacing } = theme;
  const { t } = useLocalization();
  const [confirming, setConfirming] = useState(false);
  const [unsynced, setUnsynced] = useState<number | null>(null);
  const [erasing, setErasing] = useState(false);

  const open = () => {
    setConfirming(true);
    void countUnsyncedChanges().then(setUnsynced);
  };

  if (!confirming) {
    return (
      <Pressable
        accessibilityLabel={t('profile.eraseDevice.rowAccessibility')}
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.glassFill : 'transparent',
            borderColor: colors.glassBorder,
            borderRadius: radius.field,
            borderWidth: 1,
            gap: spacing.sm,
            minHeight: theme.spacing.x5l,
            paddingHorizontal: spacing.md,
          },
        ]}
        testID="profile-erase-device"
      >
        <Icon color={colors.errorOnStage} name="logout" size={18} />
        <AppText style={{ color: colors.errorOnStage, flexShrink: 1 }} variant="label">
          {t('profile.eraseDevice.row')}
        </AppText>
      </Pressable>
    );
  }

  return (
    <GlassCard
      style={{ gap: spacing.md, padding: spacing.lg }}
      testID="profile-erase-device-confirm"
    >
      <AppText accessibilityRole="header" variant="title">
        {t('profile.eraseDevice.title')}
      </AppText>
      <AppText>{t('profile.eraseDevice.body')}</AppText>
      {unsynced !== null && unsynced > 0 ? (
        <AppText style={{ color: colors.errorOnStage }} testID="profile-erase-device-unsynced">
          {interpolate(t('profile.eraseDevice.unsynced'), { count: String(unsynced) })}
        </AppText>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <AppButton
          accessibilityLabel={t('profile.eraseDevice.confirmAccessibility')}
          loading={erasing}
          onPress={() => {
            setErasing(true);
            void signOutAndEraseThisPhone().finally(() => setErasing(false));
          }}
          testID="profile-erase-device-confirm-button"
          variant="destructive"
        >
          {t('profile.eraseDevice.confirm')}
        </AppButton>
        <AppButton onPress={() => setConfirming(false)} variant="text">
          {t('profile.eraseDevice.cancel')}
        </AppButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
