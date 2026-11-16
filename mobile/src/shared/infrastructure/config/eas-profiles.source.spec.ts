/**
 * ADR-P047 D8 (owner decision 2026-11-16): testers install only from Google
 * Play. No EAS profile distributes builds by link, the `preview`,
 * `internal-apk` and `production-validation` profiles are gone, and the two
 * local variants (`e2e`, `development`) carry the variant pair that makes
 * `app.config.js` refuse them on an EAS cloud worker.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): { readFileSync(file: string, encoding: 'utf8'): string };

interface Profile {
  distribution?: string;
  env?: Record<string, string>;
}

const eas = JSON.parse(
  require('node:fs').readFileSync(`${__dirname}/../../../../eas.json`, 'utf8'),
) as { build: Record<string, Profile> };

it('keeps only the store and local profiles', () => {
  expect(Object.keys(eas.build).sort()).toEqual(['development', 'e2e', 'internal', 'production']);
});

it('distributes nothing by link', () => {
  for (const [name, profile] of Object.entries(eas.build)) {
    expect([name, profile.distribution]).toEqual([name, undefined]);
  }
});

it.each(['development', 'e2e'])('marks %s as a local variant on both sides', (name) => {
  expect(eas.build[name].env?.APP_VARIANT).toBe(name);
  expect(eas.build[name].env?.EXPO_PUBLIC_APP_VARIANT).toBe(name);
});
