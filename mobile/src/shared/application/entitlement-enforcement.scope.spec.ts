declare const __dirname: string;
declare function require(id: 'node:fs'): {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(dir: string): string[];
  statSync(path: string): { isDirectory(): boolean };
};

const SRC = `${__dirname}/../..`.replace(/\\/g, '/');

function source(path: string): string {
  return require('node:fs').readFileSync(`${SRC}/${path}`, 'utf8');
}

function repositories(dir = `${SRC}/features`): string[] {
  const fs = require('node:fs');
  return fs.readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (fs.statSync(path).isDirectory()) return repositories(path);
    return name.endsWith('.repository.ts') ? [path.slice(SRC.length + 1)] : [];
  });
}

/** Every `enqueue(...)` call in a file, with its argument text. */
function enqueueCalls(text: string): string[] {
  const calls: string[] = [];
  let index = text.indexOf('await enqueue(');
  while (index >= 0) {
    let depth = 0;
    let end = index + 'await enqueue'.length;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')' && --depth === 0) break;
    }
    calls.push(text.slice(index, end + 1));
    index = text.indexOf('await enqueue(', end);
  }
  return calls;
}

const SQL_WRITE = /INSERT INTO|UPDATE [a-z_]+\s+SET|DELETE FROM/;

/**
 * Repositories that write SQL without a tracked, synchronized entity: the
 * local account cache backs authentication itself, which Decision 6 keeps
 * available. Server-pull appliers live outside repositories and must keep
 * working in read-only mode, so they are not repositories at all.
 */
const UNTRACKED_REPOSITORIES = new Set([
  'features/authentication/infrastructure/local-user.repository.ts',
]);

describe('ADR-P034 paid-write enforcement scope', () => {
  const TRACKED = repositories().filter(
    (path) => SQL_WRITE.test(source(path)) && !UNTRACKED_REPOSITORIES.has(path),
  );

  it('finds the tracked repositories', () => {
    expect(TRACKED.length).toBeGreaterThanOrEqual(10);
  });

  it('routes every tracked repository write through the guarded sync queue', () => {
    const missing = TRACKED.filter((path) => enqueueCalls(source(path)).length === 0);
    expect(missing).toEqual([]);
  });

  it('enqueues inside the row write transaction everywhere, so a refusal rolls the row back', () => {
    const outsideTransaction = TRACKED.flatMap((path) =>
      enqueueCalls(source(path))
        .filter((call) => !/,\s*tx\s*,?\s*\)$/.test(call.replace(/\s+/g, ' ')))
        .map((call) => `${path}: ${call.slice(0, 60)}`),
    );
    expect(outsideTransaction).toEqual([]);
  });

  it('checks access before encryption or SQL in the queue boundary', () => {
    const queue = source('shared/infrastructure/sync/sync-queue.ts');
    const enqueue = queue.indexOf('export async function enqueue');
    const assertion = queue.indexOf('assertPaidMutationAccess(input.userId)', enqueue);
    const encryption = queue.indexOf('encryptToBase64', enqueue);
    const statement = queue.indexOf('INSERT INTO sync_queue', enqueue);

    expect(assertion).toBeGreaterThan(enqueue);
    expect(assertion).toBeLessThan(encryption);
    expect(assertion).toBeLessThan(statement);
  });

  it.each([
    'app/profile-edit.tsx',
    'app/goal-edit.tsx',
    'app/wellness-safety-profile.tsx',
    'app/dietary-preferences.tsx',
    'app/food-log.tsx',
    'app/progress.tsx',
    'app/exercises.tsx',
    'app/routines.tsx',
    'app/workout-log.tsx',
  ])('%s keeps content visible behind the shared write boundary', (path) => {
    expect(source(path)).toContain('SubscriptionWriteBoundary');
  });

  it.each([
    'features/workout/presentation/GeneratedWorkoutPlan.tsx',
    'features/nutrition/presentation/NutritionPlanScreen.tsx',
  ])('%s blocks new deterministic plan generation without active access', (path) => {
    const file = source(path);
    expect(file).toContain('useEntitlementAccess');
    expect(file).toContain('SubscriptionAccessNotice');
  });

  it('blocks conflict choices while keeping their review surface mounted', () => {
    expect(source('features/sync-conflicts/presentation/SyncConflictsScreen.tsx')).toContain(
      'SubscriptionWriteBoundary',
    );
  });

  // Decision 6: sign-in, recovery, verification, subscription status/recovery
  // and account deletion stay available without an active entitlement.
  it.each([
    'app/sign-in.tsx',
    'app/forgot-password.tsx',
    'app/reset-password.tsx',
    'app/verify-email.tsx',
    'app/delete-account.tsx',
    'app/subscription.tsx',
  ])('%s is never placed behind a paid-write boundary', (path) => {
    const file = source(path);
    expect(file).not.toContain('SubscriptionWriteBoundary');
    expect(file).not.toContain('PaidWriteDisabledProvider');
  });
});
