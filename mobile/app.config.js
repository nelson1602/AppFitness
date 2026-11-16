// Dynamic Expo config. app.json stays the single source of truth; this
// file only layers variant-specific overrides on top of it (Expo passes
// app.json's "expo" object in as `config`).
//
// APP_VARIANT=e2e (set by the eas.json `e2e` build profile) enables
// Android cleartext HTTP so the E2E release APK can reach the seeded
// LOCAL test API via adb reverse (ADR-P008). This requires a config
// plugin — `android.usesCleartextTraffic` is not an Expo config schema
// field, so a raw config value is silently ignored by prebuild. Every
// other variant — production included — never loads the plugin and
// keeps the OS default: cleartext blocked (.ai/05_SECURITY.md).
//
// ADR-P047 D8: e2e APKs are built locally only. EAS sets EAS_BUILD_RUNNER to
// `eas-build` on its cloud workers, and an e2e build there is refused, so a
// cleartext APK never sits on EAS for download. The app's API config needs
// EXPO_PUBLIC_APP_VARIANT=e2e alongside to accept the http loopback URL.
const IS_E2E = process.env.APP_VARIANT === 'e2e';

if (IS_E2E && process.env.EAS_BUILD_RUNNER === 'eas-build') {
  throw new Error(
    'The e2e variant is built locally only (ADR-P047 D8): use `eas build --local --profile e2e` or Gradle.',
  );
}
if (IS_E2E && process.env.EXPO_PUBLIC_APP_VARIANT !== 'e2e') {
  throw new Error('APP_VARIANT=e2e also needs EXPO_PUBLIC_APP_VARIANT=e2e (ADR-P047 D5).');
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
    ...(IS_E2E ? ['./plugins/with-e2e-cleartext'] : []),
  ],
});
