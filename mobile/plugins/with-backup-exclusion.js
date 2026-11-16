// Local Expo config plugin (ADR-P047 D1): keep the app's data out of Android
// backup and device-to-device transfer.
//
// `android.allowBackup: false` (app.json) stops cloud backup, but on Android 12+
// it does NOT stop a device-to-device transfer. The data-extraction rules
// written here exclude every domain from both, so the SQLite database (health
// logs, notes), SecureStore's encrypted preferences and the session never
// leave the phone through either path. `fullBackupContent` covers Android 11
// and older. expo-secure-store's own backup rules are turned off in app.json
// (`configureAndroidBackup: false`) so they cannot replace these.
//
// Uses expo/config-plugins, which ships with the expo package.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const RULES_NAME = 'appfitness_data_extraction_rules';
const LEGACY_RULES_NAME = 'appfitness_full_backup_content';
const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];
const DEVICE_DOMAINS = ['device_root', 'device_file', 'device_database', 'device_sharedpref'];

const excludeAll = (domains, indent) =>
  domains.map((domain) => `${indent}<exclude domain="${domain}" path="." />`).join('\n');

const extractionRules = `<?xml version="1.0" encoding="utf-8"?>
<!-- ADR-P047 D1: nothing is backed up to the cloud or copied to a new device. -->
<data-extraction-rules>
  <cloud-backup>
${excludeAll([...DOMAINS, ...DEVICE_DOMAINS], '    ')}
  </cloud-backup>
  <device-transfer>
${excludeAll([...DOMAINS, ...DEVICE_DOMAINS], '    ')}
  </device-transfer>
</data-extraction-rules>
`;

const legacyRules = `<?xml version="1.0" encoding="utf-8"?>
<!-- ADR-P047 D1: Android 11 and older; allowBackup=false already applies. -->
<full-backup-content>
${excludeAll(DOMAINS, '  ')}
</full-backup-content>
`;

function withBackupExclusion(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('with-backup-exclusion: AndroidManifest has no <application> element');
    }
    application.$['android:allowBackup'] = 'false';
    application.$['android:dataExtractionRules'] = `@xml/${RULES_NAME}`;
    application.$['android:fullBackupContent'] = `@xml/${LEGACY_RULES_NAME}`;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${RULES_NAME}.xml`), extractionRules);
      fs.writeFileSync(path.join(dir, `${LEGACY_RULES_NAME}.xml`), legacyRules);
      return mod;
    },
  ]);
}

module.exports = withBackupExclusion;
module.exports.extractionRules = extractionRules;
module.exports.legacyRules = legacyRules;
