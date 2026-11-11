import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  GlassCard,
  Icon,
  useReducedMotion,
  withAlpha,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

import { linkBiometrics } from '../application/session-manager';
import type { BiometricKind } from '../infrastructure/biometric-capability';

type Step = 'offer' | 'working' | 'linked' | 'failed';

interface BiometricLinkSheetProps {
  kind: BiometricKind;
  /** Called once the person is done here: linked, failed, declined or superseded. */
  onDone: () => void;
}

/**
 * The offer to link biometrics after a password sign-in (ADR-P036 A1; the
 * design's "¿Entrar más rápido la próxima vez?" sheet). The OS draws the
 * biometric prompt itself; this sheet never sees biometric data.
 *
 * Nothing advances on a timer: the person moves on with a button, so the
 * confirmation stays readable for as long as they need (WCAG 2.2.1). The sheet
 * slides in only when motion is allowed.
 */
export function BiometricLinkSheet({ kind, onDone }: BiometricLinkSheetProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useLocalization();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>('offer');
  const face = kind === 'face';

  const activate = async () => {
    setStep('working');
    const outcome = await linkBiometrics(t('auth.biometric.linkPrompt'));
    if (outcome === 'linked') setStep('linked');
    else if (outcome === 'failed') setStep('failed');
    else if (outcome === 'cancelled') setStep('offer');
    else onDone();
  };

  const finished = step === 'linked' || step === 'failed';

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onDone}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={[styles.scrim, { backgroundColor: withAlpha(colors.stage, 0.6) }]}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.stageDeep,
            borderColor: colors.glassBorder,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 1,
            gap: spacing.lg,
            padding: spacing.xl,
            paddingBottom: spacing.x3l,
          }}
          testID="biometric-link-sheet"
        >
          <Icon color={colors.accentCyan} name={face ? 'face' : 'finger'} size={36} />
          {finished ? (
            <View style={{ gap: spacing.xs }}>
              <AppText accessibilityRole="header" tone="onStage" variant="title">
                {step === 'linked'
                  ? t(face ? 'auth.biometric.linkedFace' : 'auth.biometric.linkedFingerprint')
                  : t('auth.biometric.linkTitle')}
              </AppText>
              <AppText accessibilityLiveRegion="polite" tone="onStageVariant">
                {step === 'linked'
                  ? t('auth.biometric.linkedBody')
                  : t('auth.biometric.linkFailed')}
              </AppText>
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <AppText accessibilityRole="header" tone="onStage" variant="title">
                {t('auth.biometric.linkTitle')}
              </AppText>
              <AppText tone="onStageVariant">
                {t(face ? 'auth.biometric.linkBodyFace' : 'auth.biometric.linkBodyFingerprint')}
              </AppText>
            </View>
          )}
          {finished ? null : (
            <GlassCard style={{ padding: spacing.md }}>
              <AppText tone="onStageVariant" variant="caption">
                {t('auth.biometric.privacy')}
              </AppText>
            </GlassCard>
          )}
          {finished ? (
            <AppButton onPress={onDone} testID="biometric-link-continue">
              {t('auth.biometric.continue')}
            </AppButton>
          ) : (
            <>
              <AppButton
                loading={step === 'working'}
                onPress={() => void activate()}
                testID="biometric-link-activate"
              >
                {t(face ? 'auth.biometric.activateFace' : 'auth.biometric.activateFingerprint')}
              </AppButton>
              <AppButton
                disabled={step === 'working'}
                onPress={onDone}
                testID="biometric-link-not-now"
                variant="stage-link"
              >
                {t('auth.biometric.notNow')}
              </AppButton>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
