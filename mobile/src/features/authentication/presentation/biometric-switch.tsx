import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { type TranslationKey, useLocalization } from '@/shared/localization';
import { AppText, withAlpha } from '@/shared/presentation';
import { lightColors, useTheme } from '@/shared/theme';

import {
  isBiometricLinked,
  linkBiometrics,
  unlinkBiometrics,
} from '../application/session-manager';
import type { BiometricCapability } from '../infrastructure/biometric-capability';
import { useBiometricCapability } from './use-biometric-capability';

/** The prototype's switch: a 56 × 32 track with a 24 dp thumb. */
const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 32;
const THUMB = 24;
/** The prototype dims a switch that cannot be used to 40 %. */
const DISABLED_OPACITY = 0.4;

/** The row's name: the phone's own word for it, or the prototype's "Face ID o Huella". */
function labelKey(capability: BiometricCapability): TranslationKey {
  if (capability.readiness === 'unsupported') return 'auth.biometric.switch';
  return capability.kind === 'face'
    ? 'auth.biometric.signInFace'
    : 'auth.biometric.signInFingerprint';
}

function statusKey(capability: BiometricCapability, linked: boolean): TranslationKey {
  if (capability.readiness === 'unsupported') return 'auth.biometric.switchNoHardware';
  if (capability.readiness === 'not-enrolled') {
    return capability.kind === 'face'
      ? 'auth.biometric.switchNotEnrolledFace'
      : 'auth.biometric.switchNotEnrolledFingerprint';
  }
  return linked ? 'auth.biometric.switchOn' : 'auth.biometric.switchOff';
}

/**
 * Perfil → Seguridad: turns biometric sign-in on or off (ADR-P036 A7, the
 * prototype's Perfil tab). Both directions ask for biometrics. Without usable
 * biometrics the switch stays off and disabled, and the line under the name
 * says why. Native only: the Profile tab does not render it on Web.
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
  }, [capability]);

  // Unusable biometrics read as off without asking storage; usable ones wait
  // for the stored link so the switch never flips after it appears.
  if (!capability || (capability.available && linked === null)) return null;

  const usable = capability.available;
  const disabled = !usable || busy;
  const on = usable && linked === true;

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

  const label = t(labelKey(capability));
  const status = t(statusKey(capability, on));

  return (
    <Pressable
      accessibilityHint={status}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={() => void toggle()}
      style={[styles.row, { gap: theme.spacing.md, minHeight: theme.spacing.x5l }]}
      testID="biometric-switch"
    >
      <View style={styles.text}>
        <AppText tone="onStage" variant="label">
          {label}
        </AppText>
        <AppText testID="biometric-switch-status" tone="onStageVariant" variant="caption">
          {status}
        </AppText>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.track,
          {
            alignItems: on ? 'flex-end' : 'flex-start',
            backgroundColor: on ? theme.colors.accentCyan : withAlpha(theme.colors.onStage, 0.2),
            borderRadius: theme.radius.full,
            opacity: !usable ? DISABLED_OPACITY : busy ? 0.56 : 1,
          },
        ]}
        testID="biometric-switch-track"
      >
        <View
          style={{
            // White in both themes, as in the prototype.
            backgroundColor: lightColors.surface,
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: (TRACK_HEIGHT - THUMB) / 2,
    width: TRACK_WIDTH,
  },
});
