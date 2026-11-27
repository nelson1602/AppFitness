/**
 * The shown name is "Coach" (owner decision, 2026-11-27; `.ai/08_UI_UX.md`
 * §iCoach UI). "iCoach" stays the internal engine name — folder, identifiers,
 * translation keys, test ids and rule-version stamps — but never reaches a
 * person: no `es`/`en` value and no Maestro assertion may carry it.
 */
import { en } from './resources/en';
import { es } from './resources/es';

/**
 * Node built-ins used only by this Node/Jest test; the React Native tsconfig
 * ships no Node types, so the sliver used here is declared locally — the same
 * idiom as `maestro-flow-copy.spec.ts`.
 */
declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
};

const fs = require('node:fs');

/** `mobile/.maestro`, a sibling of `mobile/src`. */
const FLOW_DIR = `${__dirname.replace(/\\/g, '/').replace(/\/src\/shared\/localization$/, '')}/.maestro`;

const OLD_NAME = /icoach/i;

describe('the shown name is "Coach", never "iCoach"', () => {
  it.each([
    ['es', es],
    ['en', en],
  ] as const)('no %s value says iCoach', (_language, resource) => {
    const offenders = Object.entries(resource as Record<string, string>)
      .filter(([, value]) => OLD_NAME.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('every Maestro assertion uses the shown name', () => {
    const offenders: string[] = [];
    for (const flow of fs.readdirSync(FLOW_DIR).filter((name) => name.endsWith('.yml'))) {
      fs.readFileSync(`${FLOW_DIR}/${flow}`, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (line.trim().startsWith('#')) return;
          if (OLD_NAME.test(line)) offenders.push(`${flow}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('Spanish uses the article and English capitalizes "the Coach"', () => {
    expect(es['dashboard.recommendations']).toBe('Recomendaciones del Coach');
    expect(es['workout.plan.byICoach']).toBe('{day} · creado por el Coach');
    expect(en['dashboard.recommendations']).toBe('Coach recommendations');
    expect(en['workout.plan.byICoach']).toBe('{day} · built by the Coach');
    for (const value of Object.values(en as Record<string, string>)) {
      expect(value).not.toMatch(/\bthe coach\b/);
    }
  });
});
