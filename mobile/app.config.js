// Dynamic Expo config. app.json stays the single source of truth; this
// file only layers variant-specific overrides on top of it (Expo passes
// app.json's "expo" object in as `config`).
//
// The LOCAL variants — APP_VARIANT=e2e (eas.json `e2e`) and
// APP_VARIANT=development (eas.json `development`) — enable Android cleartext
// HTTP so a release APK can reach an API on the developer's machine through
// adb reverse (ADR-P008). This requires a config plugin —
// `android.usesCleartextTraffic` is not an Expo config schema field, so a raw
// config value is silently ignored by prebuild. Every other variant —
// `internal` and `production` included — never loads the plugin and keeps the
// OS default: cleartext blocked (.ai/05_SECURITY.md).
//
// ADR-P047 D8: local variants are built locally only. EAS sets
// EAS_BUILD_RUNNER to `eas-build` on its cloud workers, and a local-variant
// build there is refused, so a cleartext APK never sits on EAS for download.
// The app's API config needs the matching EXPO_PUBLIC_APP_VARIANT alongside
// to accept the http loopback URL.
const LOCAL_VARIANTS = ['e2e', 'development'];
const VARIANT = process.env.APP_VARIANT;
const IS_LOCAL_VARIANT = LOCAL_VARIANTS.includes(VARIANT);

if (IS_LOCAL_VARIANT && process.env.EAS_BUILD_RUNNER === 'eas-build') {
  throw new Error(
    `The ${VARIANT} variant is built locally only (ADR-P047 D8): use \`eas build --local --profile ${VARIANT}\` or Gradle.`,
  );
}
if (IS_LOCAL_VARIANT && process.env.EXPO_PUBLIC_APP_VARIANT !== VARIANT) {
  throw new Error(
    `APP_VARIANT=${VARIANT} also needs EXPO_PUBLIC_APP_VARIANT=${VARIANT} (ADR-P047 D5).`,
  );
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    'expo-localization',
    // Native Sentry SDK wiring (ADR-P010). No org/project/auth options:
    // source-map upload stays disabled until credentials are approved;
    // the JS SDK itself is a no-op without a DSN (see
    // src/shared/infrastructure/monitoring/sentry.ts).
    '@sentry/react-native/expo',
    // ADR-P047 D1: no cloud backup, no device-to-device transfer.
    './plugins/with-backup-exclusion',
    ...(IS_LOCAL_VARIANT ? ['./plugins/with-e2e-cleartext'] : []),
  ],
});
