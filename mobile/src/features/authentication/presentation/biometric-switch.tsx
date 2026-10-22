import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import { AppText } from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import {
  isBiometricLinked,
  linkBiometrics,
  unlinkBiometrics,
} from '../application/session-manager';
import { useBiometricCapability } from './use-biometric-capability';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 20;

/**
 * Temporary home for turning biometric sign-in on or off (ADR-P036 A7) until
 * the Profile tab exists (ADR-P039). Both directions ask for biometrics. It
 * renders nothing where biometrics cannot be used, including Web.
 *
 * The whole row is the control: a `switch` with its checked state, a 48 dp
 * floor, and an on/off signal carried by the thumb position as well as colour.
 */
export function BiometricSwitch() {
  const theme = useTheme();
  const { t } = useLocalization();
  const capability = useBiometricCapability();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (capability?.available) {
      void isBiometricLinked().then((value) => {
        if (active) setLinked(value);
      });
    }
    return () => {
      active = false;
    };
  }, [capability?.available]);

  if (!capability?.available || linked === null) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (linked) {
        const outcome = await unlinkBiometrics(t('auth.biometric.linkPrompt'));
        if (outcome === 'unlinked') setLinked(false);
      } else {
        const outcome = await linkBiometrics(t('auth.biometric.linkPrompt'));
        if (outcome === 'linked') setLinked(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityLabel={t('auth.biometric.switch')}
      accessibilityRole="switch"
      accessibilityState={{ checked: linked, disabled: busy }}
      disabled={busy}
      onPress={() => void toggle()}
      style={[
        styles.row,
        { gap: theme.spacing.md, minHeight: theme.spacing.x5l, opacity: busy ? 0.56 : 1 },
      ]}
      testID="biometric-switch"
    >
      <AppText style={styles.label}>{t('auth.biometric.switch')}</AppText>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.track,
          {
            alignItems: linked ? 'flex-end' : 'flex-start',
            backgroundColor: linked ? theme.colors.primary : theme.colors.surfaceVariant,
            borderColor: linked ? theme.colors.primary : theme.colors.outline,
            borderRadius: theme.radius.full,
          },
        ]}
        testID="biometric-switch-track"
      >
        <View
          style={{
            backgroundColor: linked ? theme.colors.onPrimary : theme.colors.outline,
            borderRadius: theme.radius.full,
            height: THUMB,
            width: THUMB,
          }}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  track: {
    borderWidth: 1,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: TRACK_WIDTH,
  },
});
