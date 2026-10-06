import { en } from './resources/en';
import { es } from './resources/es';

/**
 * ADR-P028 slice 5a: the public brand and native application identity must move
 * together. This source-level guard keeps CI independent from generated native
 * projects while covering the Expo config, live catalogues and device tooling.
 */

declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
};

const fs = require('node:fs');
const MOBILE = __dirname.replace(/\\/g, '/').replace(/\/src\/shared\/localization$/, '');
const PRODUCT_NAME = 'AppFitnessRD';
const NATIVE_ID = 'com.appfitnessrd.mobile';
const BARE_LEGACY_NAME = /AppFitness(?!RD| Pro)/;

interface ExpoConfig {
  expo: {
    name: string;
    slug: string;
    scheme: string;
    owner: string;
    ios: { bundleIdentifier?: string };
    android: { package?: string };
    extra: { eas: { projectId: string } };
  };
}

const read = (relative: string): string => fs.readFileSync(`${MOBILE}/${relative}`, 'utf8');

describe('ADR-P028 publication identity', () => {
  it('pins both native identifiers and the display name without renaming stable Expo identity', () => {
    const config = JSON.parse(read('app.json')) as ExpoConfig;

    expect(config.expo.name).toBe(PRODUCT_NAME);
    expect(config.expo.android.package).toBe(NATIVE_ID);
    expect(config.expo.ios.bundleIdentifier).toBe(NATIVE_ID);
    expect(config.expo.slug).toBe('appfitness');
    expect(config.expo.scheme).toBe('appfitness');
    expect(config.expo.owner).toBe('nelson1602');
    expect(config.expo.extra.eas.projectId).toBe('edf05078-6821-4bcc-b501-1d737badd36a');
  });

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('has no bare legacy product name in the %s catalogue', (_language, catalogue) => {
    const offenders = Object.entries(catalogue)
      .filter(([, value]) => BARE_LEGACY_NAME.test(value))
      .map(([key]) => key);

    expect(offenders).toEqual([]);
  });

  it('pins the two intentionally direct-rendered product headings', () => {
    expect(read('src/app/sign-in.tsx')).toContain(`>${PRODUCT_NAME}</AppText>`);
    expect(read('src/features/dashboard/presentation/DashboardScreen.tsx')).toContain(
      `>${PRODUCT_NAME}</AppText>`,
    );
  });

  it('points every Maestro flow and the theme-capture helper at the new Android app id', () => {
    const flows = fs
      .readdirSync(`${MOBILE}/.maestro`)
      .filter((file) => file.endsWith('.yml'))
      .map((file) => [file, read(`.maestro/${file}`)] as const)
      .filter(([, source]) => /^appId:/m.test(source));

    expect(flows.length).toBeGreaterThanOrEqual(25);
    expect(
      flows.filter(([, source]) => !source.includes(`appId: ${NATIVE_ID}`)).map(([file]) => file),
    ).toEqual([]);
    expect(
      flows.filter(([, source]) => BARE_LEGACY_NAME.test(source)).map(([file]) => file),
    ).toEqual([]);
    expect(read('e2e/theme-capture.mjs')).toContain(`const APP_ID = '${NATIVE_ID}';`);
  });
});
