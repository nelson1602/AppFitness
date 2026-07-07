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
const IS_E2E = process.env.APP_VARIANT === 'e2e';

module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), ...(IS_E2E ? ['./plugins/with-e2e-cleartext'] : [])],
});
