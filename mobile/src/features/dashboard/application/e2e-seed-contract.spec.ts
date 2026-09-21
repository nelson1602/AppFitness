/**
 * Public-v1 E2E seed boundary (ADR-P008 as superseded by ADR-P017).
 *
 * The cloud E1 journey executes this script directly, outside Jest. This
 * source guard keeps a removed medical route from silently returning to the
 * public journey while still requiring the current wellness sync entities.
 */

declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
};
declare const __dirname: string;

const SOURCE = require('node:fs').readFileSync(`${__dirname}/../../../../e2e/seed.mjs`, 'utf8');

describe('public-v1 E2E seed contract', () => {
  it('never invokes retained medical routes or sync entities', () => {
    expect(SOURCE).not.toMatch(/['"]\/medical\//);
    expect(SOURCE).not.toMatch(/entityType:\s*['"]medical_/);
  });

  it('seeds both wellness body-metric entities through the public sync contract', () => {
    expect(SOURCE).toMatch(/entityType:\s*['"]body_weights['"]/);
    expect(SOURCE).toMatch(/entityType:\s*['"]body_measurements['"]/);
    expect(SOURCE).toContain("'/sync/push'");
  });
});
