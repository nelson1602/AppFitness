import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MODULES_ROOT = join(__dirname, '..', '..');

function controllers(dir = MODULES_ROOT): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return controllers(path);
    return name.endsWith('.controller.ts') ? [path] : [];
  });
}

const MUTATION = /@(Post|Put|Patch|Delete)\(([^)]*)\)/g;

/**
 * Mutations ADR-P034 Decision 6 keeps available without an active entitlement:
 * authentication and recovery, account deletion, subscription status recovery
 * and the authenticated/HMAC-signed provider webhook. Anything else is a paid
 * product mutation and must carry the server-side entitlement guard.
 */
const UNGATED = new Set([
  "auth/presentation/auth.controller.ts @Post('register')",
  "auth/presentation/auth.controller.ts @Post('login')",
  "auth/presentation/auth.controller.ts @Post('refresh')",
  "auth/presentation/auth.controller.ts @Post('logout')",
  "auth/presentation/auth.controller.ts @Delete('account')",
  "auth/presentation/auth.controller.ts @Post('forgot-password')",
  "auth/presentation/auth.controller.ts @Post('reset-password')",
  "auth/presentation/auth.controller.ts @Post('resend-verification')",
  "auth/presentation/auth.controller.ts @Post('verify-email')",
  "subscriptions/presentation/subscription.controller.ts @Post('reconcile')",
  "subscriptions/presentation/subscription.controller.ts @Post('webhooks/revenuecat')",
]);

interface Mutation {
  readonly id: string;
  readonly guarded: boolean;
}

function mutations(): Mutation[] {
  return controllers().flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    const file = relative(MODULES_ROOT, path).split(sep).join('/');
    return [...source.matchAll(MUTATION)].map((match) => {
      // The decorators stacked on this handler, up to its method signature.
      const start = match.index ?? 0;
      const handler =
        source.slice(start, start + 400).split(/\n\s*(?:async\s+)?\w+\(/)[0] ??
        '';
      return {
        id: `${file} @${match[1]}(${match[2]})`,
        guarded: handler.includes('@UseGuards(ActiveEntitlementGuard)'),
      };
    });
  });
}

describe('paid mutation enforcement scope', () => {
  const all = mutations();

  it('discovers every controller mutation', () => {
    expect(all.length).toBeGreaterThanOrEqual(UNGATED.size + 6);
  });

  it('guards every product mutation that is not explicitly kept available', () => {
    const unguarded = all
      .filter((m) => !m.guarded && !UNGATED.has(m.id))
      .map((m) => m.id);
    expect(unguarded).toEqual([]);
  });

  it('never gates authentication, recovery, account deletion or subscription recovery', () => {
    const gatedButFree = all
      .filter((m) => m.guarded && UNGATED.has(m.id))
      .map((m) => m.id);
    expect(gatedButFree).toEqual([]);
  });

  it('keeps the allow-list honest: every entry still exists', () => {
    const ids = new Set(all.map((m) => m.id));
    expect([...UNGATED].filter((id) => !ids.has(id))).toEqual([]);
  });

  it.each([
    "sync/presentation/sync.controller.ts @Post('push')",
    "sync/presentation/sync.controller.ts @Post('conflicts/:id/resolve')",
    "users/presentation/users.controller.ts @Put('profile')",
    "medical/presentation/medical.controller.ts @Post('evaluations')",
    "medical/presentation/medical.controller.ts @Delete('evaluations/:id')",
    "medical/presentation/medical.controller.ts @Post('restrictions')",
  ])('guards %s', (id) => {
    expect(all.find((m) => m.id === id)?.guarded).toBe(true);
  });
});
