/**
 * ADR-P048: the Health Connect config plugin declares exactly the four READ
 * permissions the owner approved (no write, no background read, no other
 * type), raises minSdk to 26, and routes Health Connect's rationale intent to
 * the app's `/health-connect` screen. Every variant loads it.
 */
declare const __dirname: string;

interface ManifestEntry {
  $: Record<string, string>;
}
interface Plugin {
  MIN_SDK: string;
  HEALTH_PERMISSIONS: string[];
  RATIONALE_URL: string;
  addRationaleRoute: (source: string) => string;
  applyHealthPermissions: (
    manifest: Record<string, ManifestEntry[]>,
  ) => Record<string, ManifestEntry[]>;
}
declare function require(id: string): unknown;

const ROOT = `${__dirname}/../../../..`;
const plugin = require(`${ROOT}/plugins/with-health-connect.js`) as Plugin;

const MAIN_ACTIVITY = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
  }
}
`;

describe('with-health-connect (ADR-P048)', () => {
  it('declares exactly the four read permissions', () => {
    expect(plugin.HEALTH_PERMISSIONS).toEqual([
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.READ_HYDRATION',
    ]);
    const manifest = plugin.applyHealthPermissions({
      'uses-permission': [
        { $: { 'android:name': 'android.permission.INTERNET' } },
        { $: { 'android:name': 'android.permission.health.READ_HEART_RATE' } },
        { $: { 'android:name': 'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND' } },
        { $: { 'android:name': 'android.permission.health.WRITE_STEPS' } },
      ],
    });
    expect(manifest['uses-permission'].map((entry) => entry.$['android:name'])).toEqual([
      'android.permission.INTERNET',
      ...plugin.HEALTH_PERMISSIONS,
    ]);
  });

  it('raises the Android minimum to API 26', () => {
    expect(plugin.MIN_SDK).toBe('26');
  });

  it('turns the rationale intent into the app route, once', () => {
    const routed = plugin.addRationaleRoute(MAIN_ACTIVITY);
    expect(routed).toContain('    routeHealthConnectRationale(intent)\n    super.onCreate(null)');
    expect(routed).toContain('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE');
    expect(routed).toContain('android.intent.action.VIEW_PERMISSION_USAGE');
    expect(routed).toContain(`Uri.parse("${plugin.RATIONALE_URL}")`);
    expect(routed).toContain('override fun onNewIntent');
    expect(plugin.RATIONALE_URL).toBe('appfitness://health-connect');
    expect(plugin.addRationaleRoute(routed)).toBe(routed);
  });

  it('is loaded for every variant, with the library plugin', () => {
    const fs = require('node:fs') as { readFileSync(file: string, enc: 'utf8'): string };
    const config = fs.readFileSync(`${ROOT}/app.config.js`, 'utf8');
    expect(config).toMatch(
      /'react-native-health-connect',\r?\n\s*'\.\/plugins\/with-health-connect',/,
    );
  });
});
