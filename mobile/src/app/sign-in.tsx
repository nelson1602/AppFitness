import { type Href, Stack, router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AuthError,
  type AuthErrorReason,
  BiometricLinkSheet,
  getSession,
  signIn,
  signUp,
  unlockWithBiometrics,
  useBiometricCapability,
  useSession,
} from '@/features/authentication';
import { landingRouteFor } from '@/features/authentication/application/access-gate';
import { meetsPasswordPolicy } from '@/features/authentication/domain/password-policy';
import { PasswordChecklist } from '@/features/authentication/presentation/password-checklist';
import { PrivacyPolicyLink } from '@/features/legal/presentation/privacy-policy-link';
import { deviceDefaultCountry, rememberMySignupCountry } from '@/features/profile';
import { CountrySelect } from '@/features/profile/presentation/CountrySelect';
import {
  AuthScreen,
  HERO_MIN_HEIGHT,
  useWebWindowHeight,
  webHeroMaxHeight,
} from '@/features/authentication/presentation/auth-screen';
import { LanguageSelector, type TranslationKey, useLocalization } from '@/shared/localization';
import {
  AppButton,
  AppText,
  AppTextInput,
  Banner,
  GlassCard,
  GradientText,
  Icon,
  type IconName,
  Mascot,
  Pulse,
} from '@/shared/presentation';
import { useTheme } from '@/shared/theme';

// Reason → localized banner copy (Slice 2B4). Distinct, honest, non-enumerating
// messages; raw errors/tokens/server details are never shown.
const ERROR_COPY: Record<AuthErrorReason, { title: TranslationKey; body: TranslationKey }> = {
  'invalid-credentials': {
    title: 'auth.error.invalidCredentialsTitle',
    body: 'auth.error.invalidCredentialsBody',
  },
  'registration-unavailable': {
    title: 'auth.error.registrationTitle',
    body: 'auth.error.registrationBody',
  },
  connectivity: { title: 'auth.error.connectivityTitle', body: 'auth.error.connectivityBody' },
  server: { title: 'auth.error.serverTitle', body: 'auth.error.serverBody' },
  unexpected: { title: 'auth.error.unexpectedTitle', body: 'auth.error.unexpectedBody' },
};

export default function SignInScreen() {
  const theme = useTheme();
  const { t, language } = useLocalization();
  // Web fits the whole screen in a desktop window: the hero gives up height
  // to the rest of the screen (measured), and the sections sit a little closer.
  const web = Platform.OS === 'web';
  const windowHeight = useWebWindowHeight();
  const [measured, setMeasured] = useState({ content: 0, hero: 0 });
  const measure = (key: 'content' | 'hero') => (event: LayoutChangeEvent) => {
    const value = Math.round(event.nativeEvent.layout.height);
    setMeasured((current) => (current[key] === value ? current : { ...current, [key]: value }));
  };
  const otherContent =
    measured.content > 0 ? measured.content - measured.hero + 2 * theme.spacing.lg : 0;
  const heroMaxHeight = !web
    ? undefined
    : windowHeight === null
      ? HERO_MIN_HEIGHT
      : webHeroMaxHeight(windowHeight, otherContent);
  const sectionGap = web ? theme.spacing.md : theme.spacing.lg;
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  // Release-visible surface: fields start empty — never prefilled
  // credentials (10_DEPLOYMENT.md: "No test credentials included").
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // v8.1: "País" — preselected from the device region, else República Dominicana.
  const [country, setCountry] = useState<string>(deviceDefaultCountry);
  const [loading, setLoading] = useState(false);
  const [errorReason, setErrorReason] = useState<AuthErrorReason | null>(null);
  const [policyError, setPolicyError] = useState(false);
  // ADR-P036. `locked`: a biometric-linked session waits to be unlocked here.
  const { status } = useSession();
  const capability = useBiometricCapability();
  const biometricsAvailable = capability?.available === true;
  const locked = status === 'locked';
  /** Where a password sign-in goes once the biometric offer is done. */
  const [offerLinkThen, setOfferLinkThen] = useState<Href | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [biometricReset, setBiometricReset] = useState(false);
  /**
   * Which submission this screen currently owns (ADR-P030 C-1).
   *
   * `superseded` says the session layer discarded the attempt, but not why: it
   * may be a newer submission from this screen, or something external such as a
   * sign-out. Returning early without clearing `loading` was therefore unsafe —
   * an external supersession left the form spinning forever with no attempt
   * left to clear it. Ownership is what decides: the latest submission owns
   * `loading`, whatever the outcome, and an older one may never touch it.
   */
  const submissionRef = useRef(0);
  // BUG-035 (Web only): Enter can submit too, and two quick presses both run
  // before React re-renders with `loading`, so on Web a ref keeps a second
  // request from starting. Native keeps the ADR-P030 ownership model above
  // unchanged, where a double tap within one frame is two owned submissions.
  const inFlight = useRef(false);

  const submit = async () => {
    if (Platform.OS === 'web') {
      if (inFlight.current) return;
      inFlight.current = true;
    }
    const submission = submissionRef.current + 1;
    submissionRef.current = submission;
    const ownsScreen = () => submissionRef.current === submission;

    // ADR-P041 D1: a password the live checklist rejects never leaves the device.
    if (mode === 'register' && !meetsPasswordPolicy(password)) {
      inFlight.current = false;
      setErrorReason(null);
      setPolicyError(true);
      return;
    }

    setLoading(true);
    setErrorReason(null);
    setPolicyError(false);
    try {
      const outcome =
        mode === 'register'
          ? await signUp({ email, username, password, locale: language })
          : await signIn({ email, password });
      // The session layer replaced this attempt. Never navigate and never show
      // an error for it — a superseded attempt acted for an account the user no
      // longer asked for.
      if (outcome.status === 'superseded') return;
      // v8.1: the profile does not exist yet; the country waits on the device
      // until the evaluation creates it. Never blocks sign-up (failures are logged).
      if (mode === 'register') await rememberMySignupCountry(outcome.session.user.id, country);
      // ADR-P041 D2: an unverified account lands on "Verifica tu correo".
      // After sign-up the first email is already on its way, so resend waits.
      const landing = landingRouteFor(outcome.session.user);
      const next: Href =
        landing === '/verify-pending' && mode === 'register'
          ? { pathname: landing, params: { sent: '1' } }
          : landing;
      // A password sign-in offers biometric linking first (ADR-P036 A1); the
      // landing route follows once the person is done with the offer.
      if (mode === 'sign-in' && biometricsAvailable && ownsScreen()) {
        setOfferLinkThen(next);
        return;
      }
      router.replace(next);
    } catch (error) {
      // Only the typed, safe reason is used — never the raw error/message. A
      // superseded attempt never throws, so no stale banner can appear here;
      // and an older submission's failure must not overwrite a newer one.
      if (!ownsScreen()) return;
      setErrorReason(error instanceof AuthError ? error.reason : 'unexpected');
    } finally {
      // Cleared for every outcome — including `superseded`, so an external
      // sign-out cannot strand the spinner — but only by the submission that
      // still owns the screen.
      inFlight.current = false;
      if (ownsScreen()) setLoading(false);
    }
  };

  // ADR-P036 A2: one prompt opens the sealed session. Any failure leaves the
  // password form in place; a reset says why biometrics were turned off.
  const unlock = async () => {
    setUnlocking(true);
    setBiometricReset(false);
    try {
      const outcome = await unlockWithBiometrics(t('auth.biometric.unlockPrompt'));
      const session = outcome === 'unlocked' ? getSession() : null;
      if (session) router.replace(landingRouteFor(session.user));
      else if (outcome === 'reset') setBiometricReset(true);
    } finally {
      setUnlocking(false);
    }
  };

  const headline = {
    ...theme.typography.headline,
    fontFamily: theme.typography.display.fontFamily,
  };

  return (
    <AuthScreen>
      <Stack.Screen options={{ headerShown: false, title: t('auth.screenTitle') }} />
      <View onLayout={measure('content')} style={{ gap: sectionGap }} testID="sign-in-content">
        {/* Brand art melting into the stage, with the heartbeat under it
          (ADR-P035). Full-bleed: it cancels the screen padding. */}
        <View style={{ marginHorizontal: -theme.spacing.lg, marginTop: -theme.spacing.lg }}>
          {/* The art carries the AppFitnessRD wordmark, so it is the product's name
            here (ADR-P028), not decoration. */}
          <View onLayout={measure('hero')} testID="sign-in-hero">
            <Mascot
              accessibilityLabel={t('brand.name')}
              maxHeight={heroMaxHeight}
              testID="sign-in-mascot"
              variant="hero"
            />
          </View>
          <View style={{ marginTop: -theme.spacing.lg }}>
            <Pulse gradientId="pulse-sign-in" testID="sign-in-pulse" />
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          {/* One heading, one name: the split words (the last one in the brand
            gradient) are hidden and the sentence is announced once. */}
          <View
            accessibilityLabel={t('auth.headline')}
            accessibilityRole="header"
            accessible
            style={styles.headline}
            testID="sign-in-headline"
          >
            <Text allowFontScaling style={[headline, { color: theme.colors.onStage }]}>
              {`${t('auth.headlineLead')} `}
            </Text>
            <GradientText
              end={theme.colors.accentEnergy}
              start={theme.colors.accentCyan}
              textStyle={headline}
            >
              {t('auth.headlineAccent')}
            </GradientText>
          </View>
          <AppText tone="onStageVariant">{t('auth.subtitle')}</AppText>
        </View>

        {errorReason ? (
          <Banner title={t(ERROR_COPY[errorReason].title)} tone="error">
            {t(ERROR_COPY[errorReason].body)}
          </Banner>
        ) : null}
        {policyError && mode === 'register' && !meetsPasswordPolicy(password) ? (
          <Banner title={t('auth.passwordRules.incomplete')} tone="error" />
        ) : null}
        {biometricReset || (locked && capability !== null && !biometricsAvailable) ? (
          // A failed unlock reset, or a locked phone whose biometrics were
          // removed since linking: the password is the way in (ADR-P036 A4).
          <Banner title={t('auth.biometric.resetTitle')} tone="info">
            {t('auth.biometric.resetBody')}
          </Banner>
        ) : null}

        <GlassCard style={web ? { padding: theme.spacing.lg } : undefined} testID="sign-in-form">
          <StageField
            icon="mail"
            keyboardType="email-address"
            label={t('auth.email')}
            onChangeText={setEmail}
            onWebSubmit={() => void submit()}
            testID="input-email"
            value={email}
          />
          {mode === 'register' ? (
            <StageField
              label={t('auth.username')}
              onChangeText={setUsername}
              onWebSubmit={() => void submit()}
              testID="input-username"
              value={username}
            />
          ) : null}
          {mode === 'register' ? (
            <CountrySelect onChange={setCountry} testID="input-country" value={country} />
          ) : null}
          <StageField
            accessory={
              mode === 'sign-in' ? (
                // Recovery entry point (ADR-P026 Vertical 1). Sign-in only: there
                // is nothing to recover while creating an account. The visible
                // link is the design's short copy; the full sentence is its name.
                <AppButton
                  accessibilityLabel={t('auth.forgotPassword')}
                  onPress={() => router.push('/forgot-password')}
                  style={styles.inlineLink}
                  testID="button-forgot-password"
                  variant="stage-link"
                >
                  {t('auth.forgotPasswordShort')}
                </AppButton>
              ) : null
            }
            icon="lock"
            label={t('auth.password')}
            onChangeText={setPassword}
            onWebSubmit={() => void submit()}
            secureTextEntry
            testID="input-password"
            value={password}
          />
          {mode === 'register' ? <PasswordChecklist password={password} /> : null}
          <AppButton
            loading={loading}
            onPress={() => void submit()}
            style={{ borderRadius: theme.radius.large, minHeight: theme.spacing.x6l }}
          >
            {mode === 'register' ? t('auth.register') : t('auth.signIn')}
          </AppButton>
          {locked && biometricsAvailable && mode === 'sign-in' ? (
            // ADR-P036 A2: one prompt opens the sealed session.
            <AppButton
              loading={unlocking}
              onPress={() => void unlock()}
              style={{ borderRadius: theme.radius.large }}
              testID="button-biometric-unlock"
              variant="stage-secondary"
            >
              {t(
                capability?.kind === 'face'
                  ? 'auth.biometric.signInFace'
                  : 'auth.biometric.signInFingerprint',
              )}
            </AppButton>
          ) : null}
          {!locked && biometricsAvailable && mode === 'sign-in' ? (
            // The design's hint, until biometrics are linked.
            <View
              style={[
                styles.hint,
                {
                  backgroundColor: theme.colors.glassFill,
                  borderRadius: theme.radius.field,
                  gap: theme.spacing.sm,
                  padding: theme.spacing.md,
                },
              ]}
              testID="biometric-hint"
            >
              <Icon
                color={theme.colors.linkOnStage}
                name={capability?.kind === 'face' ? 'face' : 'finger'}
                size={18}
              />
              <AppText style={styles.hintText} tone="onStageVariant" variant="caption">
                {t('auth.biometric.hint')}
              </AppText>
            </View>
          ) : null}

          {mode === 'sign-in' ? (
            <View style={[styles.divider, { gap: theme.spacing.md }]}>
              <View style={[styles.rule, { backgroundColor: theme.colors.glassBorder }]} />
              <AppText tone="onStageVariant" variant="label">
                {t('auth.newHere')}
              </AppText>
              <View style={[styles.rule, { backgroundColor: theme.colors.glassBorder }]} />
            </View>
          ) : null}
          {/* Account-creation entry point. Mode switch only — same handler as before. */}
          <AppButton
            onPress={() => {
              setPolicyError(false);
              setMode(mode === 'register' ? 'sign-in' : 'register');
            }}
            style={{ borderRadius: theme.radius.large }}
            testID="button-toggle-mode"
            variant="stage-secondary"
          >
            {mode === 'register' ? t('auth.useExistingAccount') : t('auth.createAccount')}
          </AppButton>
          {mode === 'register' ? <PrivacyPolicyLink testID="register-privacy-policy" /> : null}
        </GlassCard>

        <LanguageSelector appearance="stage" />
      </View>
      {offerLinkThen !== null && capability ? (
        <BiometricLinkSheet
          kind={capability.kind}
          onDone={() => {
            const next = offerLinkThen;
            setOfferLinkThen(null);
            router.replace(next);
          }}
        />
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  fieldIcon: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  hint: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  hintText: {
    flex: 1,
  },
  headline: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inlineLink: {
    paddingHorizontal: 0,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});

/** Room for the leading icon inside the field (icon 18 + gaps). */
const ICON_INSET = 28;
/** Room for the 44×44 show/hide button inside the password field. */
const TOGGLE_INSET = 40;

interface StageFieldProps {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  icon?: IconName;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  /** A control on the label row, e.g. the forgot-password link. */
  accessory?: ReactNode;
  /** Web only: Enter submits and keeps focus in the field (BUG-035). */
  onWebSubmit?: () => void;
}

function StageField({
  label,
  testID,
  value,
  onChangeText,
  icon,
  keyboardType = 'default',
  secureTextEntry = false,
  accessory,
  onWebSubmit,
}: StageFieldProps) {
  const theme = useTheme();
  const { t } = useLocalization();
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={styles.labelRow}>
        <AppText tone="onStage" variant="label">
          {label}
        </AppText>
        {accessory}
      </View>
      <View>
        <AppTextInput
          accessibilityLabel={label}
          appearance="stage"
          autoCapitalize="none"
          insetEnd={secureTextEntry ? TOGGLE_INSET : 0}
          insetStart={icon ? ICON_INSET : 0}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onWebSubmit={onWebSubmit}
          secureTextEntry={secureTextEntry && !revealed}
          testID={testID}
          value={value}
        />
        {icon ? (
          <View pointerEvents="none" style={[styles.fieldIcon, { left: theme.spacing.md }]}>
            <Icon color={theme.colors.fieldIcon} name={icon} size={18} />
          </View>
        ) : null}
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
            accessibilityRole="button"
            hitSlop={theme.spacing.xs}
            onPress={() => setRevealed((shown) => !shown)}
            style={[
              styles.fieldIcon,
              {
                alignItems: 'center',
                borderRadius: theme.radius.medium,
                minHeight: theme.spacing.x5l,
                minWidth: theme.spacing.x5l,
                right: theme.spacing.xs,
              },
            ]}
            testID={`${testID}-visibility`}
          >
            <Icon color={theme.colors.fieldIcon} name={revealed ? 'eyeOff' : 'eye'} size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
