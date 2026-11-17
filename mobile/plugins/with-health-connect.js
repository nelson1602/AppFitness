// Local Expo config plugin (ADR-P048): Health Connect, read-only.
//
// - Raises the Android minimum to API 26, which androidx.health.connect
//   needs. Expo 57 reads `android.minSdkVersion` from gradle.properties into
//   its version catalog, so no expo-build-properties dependency is needed.
// - Declares exactly the four READ permissions the owner approved: steps,
//   active calories, exercise sessions and hydration. No write permission, no
//   background-read permission, no other data type.
// - Keeps the library's own plugin (react-native-health-connect) for the
//   permission-rationale intent filter and the Android 14 activity alias.
//
// Every variant loads this plugin: Play reviews the declared permissions
// whether or not the in-app flag (EXPO_PUBLIC_HEALTH_CONNECT) is on.
// Uses expo/config-plugins, which ships with the expo package.
const {
  withAndroidManifest,
  withGradleProperties,
  withMainActivity,
} = require('expo/config-plugins');

const MIN_SDK = '26';
const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_HYDRATION',
];

function withMinSdk(config) {
  return withGradleProperties(config, (mod) => {
    const items = mod.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.minSdkVersion'),
    );
    items.push({ type: 'property', key: 'android.minSdkVersion', value: MIN_SDK });
    mod.modResults = items;
    return mod;
  });
}

/**
 * The app manifest's permissions with exactly the four health reads: any other
 * android.permission.health.* entry in the app config is dropped. (Libraries'
 * own manifests merge later in Gradle; the built bundle's merged manifest is
 * checked for the same four in the release checks.)
 */
function applyHealthPermissions(manifest) {
  const declared = manifest['uses-permission'] ?? [];
  const others = declared.filter(
    (entry) => !entry.$['android:name'].startsWith('android.permission.health.'),
  );
  manifest['uses-permission'] = [
    ...others,
    ...HEALTH_PERMISSIONS.map((name) => ({ $: { 'android:name': name } })),
  ];
  return manifest;
}

function withHealthPermissions(config) {
  return withAndroidManifest(config, (mod) => {
    applyHealthPermissions(mod.modResults.manifest);
    return mod;
  });
}

// Health Connect opens the app with one of these actions when the person taps
// the privacy-policy link in its permission dialog (the first through Android
// 13, the second from 14 via the library's activity alias). Neither carries a
// URL, so MainActivity turns both into the app's rationale route; Expo Router
// then opens `/health-connect` like any other deep link.
const RATIONALE_URL = 'appfitness://health-connect';
const MARKER = 'appfitness-health-connect-rationale';
const ROUTE_FUNCTION = `
  // ${MARKER} (ADR-P048): the Health Connect rationale opens the app's screen.
  private fun routeHealthConnectRationale(intent: android.content.Intent?) {
    val action = intent?.action ?: return
    if (action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      intent.data = android.net.Uri.parse("${RATIONALE_URL}")
    }
  }

  override fun onNewIntent(intent: android.content.Intent) {
    routeHealthConnectRationale(intent)
    super.onNewIntent(intent)
  }
`;

function addRationaleRoute(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes('super.onCreate(')) {
    throw new Error('with-health-connect: MainActivity has no super.onCreate call');
  }
  if (/override fun onNewIntent/.test(source)) {
    throw new Error('with-health-connect: MainActivity already overrides onNewIntent');
  }
  const withCall = source.replace(
    /\n([ \t]*)super\.onCreate\(/,
    `\n$1routeHealthConnectRationale(intent)\n$1super.onCreate(`,
  );
  const lastBrace = withCall.lastIndexOf('}');
  return `${withCall.slice(0, lastBrace)}${ROUTE_FUNCTION}}\n`;
}

function withRationaleRoute(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('with-health-connect: expected a Kotlin MainActivity');
    }
    mod.modResults.contents = addRationaleRoute(mod.modResults.contents);
    return mod;
  });
}

function withHealthConnect(config) {
  return withRationaleRoute(withHealthPermissions(withMinSdk(config)));
}

module.exports = withHealthConnect;
module.exports.MIN_SDK = MIN_SDK;
module.exports.HEALTH_PERMISSIONS = HEALTH_PERMISSIONS;
module.exports.RATIONALE_URL = RATIONALE_URL;
module.exports.addRationaleRoute = addRationaleRoute;
module.exports.applyHealthPermissions = applyHealthPermissions;
