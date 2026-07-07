// Local Expo config plugin (ADR-P008): sets android:usesCleartextTraffic
// on the application element so E2E release builds can reach the seeded
// LOCAL test API over http:// via adb reverse.
//
// Wired in app.config.js ONLY when APP_VARIANT === 'e2e' — production and
// every other variant never load this plugin, keeping the OS default of
// cleartext blocked (.ai/05_SECURITY.md). Uses expo/config-plugins, which
// ships with the expo package — no additional dependency.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withE2eCleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('with-e2e-cleartext: AndroidManifest has no <application> element');
    }
    application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
