import {
  INJURY_MAP_VERSION,
  INJURY_MOVEMENT_MAP,
  INJURY_PREFERRED_SUBSTITUTES,
  movementsForInjuries,
} from './injury-movement-map';
import { BUILT_IN_EXERCISES } from '@/features/workout/infrastructure/exercise-catalog.data';

// The sliver of Node this doc-parity check needs; the RN tsconfig ships no
// Node types (same approach as the migration specs).
declare const __dirname: string;
declare function require(id: 'node:fs'): { readFileSync(file: string, encoding: 'utf8'): string };

const DOC = `${__dirname}/../../../../../docs/design/INJURY_EXERCISE_MAP.md`;

/** Rows of the markdown table: stored value → excluded movements. */
function documentedMap(): Record<string, string[]> {
  const text = require('node:fs').readFileSync(DOC, 'utf8');
  const rows: Record<string, string[]> = {};
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    const value = /^`([a-z_]+)`$/.exec(cells[2] ?? '')?.[1];
    if (!value) continue;
    rows[value] = [...(cells[3] ?? '').matchAll(/`([a-z_]+)`/g)].map((match) => match[1]);
  }
  return rows;
}

describe('injury → movement map (ADR-P040 D5)', () => {
  it('matches docs/design/INJURY_EXERCISE_MAP.md row for row', () => {
    const documented = documentedMap();
    expect(Object.keys(documented).sort()).toEqual(Object.keys(INJURY_MOVEMENT_MAP).sort());
    for (const [area, movements] of Object.entries(documented)) {
      expect(
        [...(INJURY_MOVEMENT_MAP[area as keyof typeof INJURY_MOVEMENT_MAP] ?? [])].sort(),
      ).toEqual([...movements].sort());
    }
  });

  it('is versioned as pending professional review, in code and in the document', () => {
    expect(INJURY_MAP_VERSION).toBe('injury-map@1.0.0-pending-review');
    expect(require('node:fs').readFileSync(DOC, 'utf8')).toContain(INJURY_MAP_VERSION);
  });

  it('unions and sorts movements deterministically', () => {
    expect(movementsForInjuries(['shin_splints', 'plantar_fasciitis'])).toEqual([
      'high_impact_cardio',
      'jumping',
      'running',
      'sprinting',
    ]);
    expect(movementsForInjuries([])).toEqual([]);
    expect(movementsForInjuries(['forearm'])).toEqual([]);
  });

  it('only names built-in exercises as substitutes, and never an excluded one for that injury', () => {
    const keys = new Set(BUILT_IN_EXERCISES.map((exercise) => exercise.key));
    for (const [from, substitutes] of Object.entries(INJURY_PREFERRED_SUBSTITUTES)) {
      expect(keys.has(from)).toBe(true);
      for (const key of substitutes) expect(keys.has(key)).toBe(true);
    }
  });
});
