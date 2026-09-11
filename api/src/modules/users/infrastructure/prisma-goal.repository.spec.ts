import type { PrismaService } from '../../database/prisma.service';
import type { SyncTx } from '../../sync/domain/sync.types';
import { PrismaGoalRepository } from './prisma-goal.repository';

const USER = 'user-1';
const GOAL_ID = '55555555-5555-4555-8555-555555555555';

/**
 * The push transaction client. `$executeRaw` is captured as a tagged template so
 * the static statement and its driver parameters can both be asserted.
 */
type FakeTx = {
  $executeRaw: jest.Mock;
  goal: { findFirst: jest.Mock; updateMany: jest.Mock };
};

function fakeTx(): FakeTx {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    goal: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

/**
 * A root client that throws on any model access. ADR-P030 §Decision 3: no
 * transaction-scoped helper may fall back to it, so touching it fails the spec.
 * Only `changedSince` (the pull path) is allowed to use it, and it is given its
 * own instance below.
 */
function forbiddenRoot(): PrismaService {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `root client must not be used (accessed ${String(prop)})`,
        );
      },
    },
  ) as unknown as PrismaService;
}

/** The SQL text of the last tagged-template call, with runs of space collapsed. */
function sqlOf(mock: jest.Mock): string {
  const [strings] = mock.mock.calls[0] as [TemplateStringsArray];
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function valuesOf(mock: jest.Mock): unknown[] {
  const [, ...values] = mock.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

describe('PrismaGoalRepository (ADR-P030 C-2)', () => {
  let tx: FakeTx;
  let repo: PrismaGoalRepository;

  beforeEach(() => {
    tx = fakeTx();
    repo = new PrismaGoalRepository(forbiddenRoot());
  });

  describe('create', () => {
    it('is a static statement with ON CONFLICT (id) DO NOTHING and no dynamic identifier', async () => {
      await repo.create(tx as unknown as SyncTx, USER, GOAL_ID, {
        goalType: 'FAT_LOSS',
      });

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).toContain('INSERT INTO goals');
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
      // Every value is a driver parameter — the template has no interpolated
      // SQL fragment and no *Unsafe entry point is used.
      expect(sql).not.toMatch(/goals\s*\?/);
    });

    it('omits the database-owned columns so their defaults and the sync_seq trigger apply', async () => {
      await repo.create(tx as unknown as SyncTx, USER, GOAL_ID, {
        goalType: 'FAT_LOSS',
      });

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).not.toContain('created_at');
      expect(sql).not.toContain('sync_seq');
      expect(sql).not.toMatch(/\bversion\b/);
      // updated_at is NOT NULL with no database default, so it is written.
      expect(sql).toContain('updated_at');
    });

    it('materialises the application defaults the payload omitted', async () => {
      const before = Date.now();
      await repo.create(tx as unknown as SyncTx, USER, GOAL_ID, {
        goalType: 'FAT_LOSS',
      });

      const values = valuesOf(tx.$executeRaw);
      // id, userId, goalType, targetWeightKg, targetDate, isActive,
      // startedAt, endedAt, updatedAt
      expect(values[0]).toBe(GOAL_ID);
      expect(values[1]).toBe(USER);
      expect(values[2]).toBe('FAT_LOSS');
      expect(values[3]).toBeNull();
      expect(values[4]).toBeNull();
      expect(values[5]).toBe(true); // is_active default
      expect(values[6]).toBeInstanceOf(Date); // started_at default = now
      expect((values[6] as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect(values[7]).toBeNull();
      expect(values[8]).toBeInstanceOf(Date); // updated_at
    });

    it('keeps the values the payload did send', async () => {
      const startedAt = new Date('2026-03-01T10:00:00Z');
      await repo.create(tx as unknown as SyncTx, USER, GOAL_ID, {
        goalType: 'STRENGTH',
        targetWeightKg: 81.5,
        targetDate: '2026-12-31',
        isActive: false,
        startedAt,
      });

      const values = valuesOf(tx.$executeRaw);
      expect(values[2]).toBe('STRENGTH');
      expect(values[3]).toBe(81.5);
      // A date-only column is passed as YYYY-MM-DD and cast ::date, so no
      // session timezone can shift the calendar day.
      expect(values[4]).toBe('2026-12-31');
      expect(sqlOf(tx.$executeRaw)).toContain('::date');
      expect(values[5]).toBe(false);
      expect(values[6]).toBe(startedAt);
    });

    it('returns the affected-row count — 0 on a primary-key collision', async () => {
      tx.$executeRaw.mockResolvedValue(0);

      await expect(
        repo.create(tx as unknown as SyncTx, USER, GOAL_ID, {
          goalType: 'FAT_LOSS',
        }),
      ).resolves.toBe(0);
    });
  });

  describe('conditional writes', () => {
    it('update asserts owner + expected version + a live row, and bumps the version', async () => {
      const count = await repo.update(
        tx as unknown as SyncTx,
        USER,
        GOAL_ID,
        { targetWeightKg: 76 },
        4,
      );

      expect(count).toBe(1);
      expect(tx.goal.updateMany).toHaveBeenCalledWith({
        where: { id: GOAL_ID, userId: USER, version: 4, deletedAt: null },
        data: { targetWeightKg: 76, version: 5 },
      });
    });

    it('update leaves the attributes the payload omitted untouched (A-15(d))', async () => {
      await repo.update(
        tx as unknown as SyncTx,
        USER,
        GOAL_ID,
        { isActive: false },
        4,
      );

      const [{ data }] = tx.goal.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(Object.keys(data).sort()).toEqual(['isActive', 'version']);
    });

    it('update writes an explicit null rather than skipping it', async () => {
      await repo.update(
        tx as unknown as SyncTx,
        USER,
        GOAL_ID,
        { targetWeightKg: null, targetDate: null },
        4,
      );

      const [{ data }] = tx.goal.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.targetWeightKg).toBeNull();
      expect(data.targetDate).toBeNull();
    });

    it('update reports 0 when the predicate matches nothing', async () => {
      tx.goal.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.update(tx as unknown as SyncTx, USER, GOAL_ID, {}, 4),
      ).resolves.toBe(0);
    });

    it('softDelete carries owner + expected version + a live row', async () => {
      await repo.softDelete(tx as unknown as SyncTx, USER, GOAL_ID, USER, 4);

      const [{ where, data }] = tx.goal.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: GOAL_ID,
        userId: USER,
        version: 4,
        deletedAt: null,
      });
      expect(data.deletedBy).toBe(USER);
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.version).toBe(5);
    });
  });

  describe('resolve', () => {
    it('uses the live-row predicate when the reviewed row was not a tombstone', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, GOAL_ID, {
        operation: 'UPDATE',
        attributes: { isActive: true },
        expectedVersion: 9,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.goal.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: GOAL_ID,
        userId: USER,
        version: 9,
        deletedAt: null,
      });
      expect(data).not.toHaveProperty('deletedAt');
      expect(data.version).toBe(10);
    });

    it('requires a tombstone and restores it when the reviewed row was deleted', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, GOAL_ID, {
        operation: 'UPDATE',
        attributes: { isActive: true },
        expectedVersion: 9,
        expectedDeleted: true,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.goal.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where.deletedAt).toEqual({ not: null });
      expect(data.deletedAt).toBeNull();
      expect(data.deletedBy).toBeNull();
    });

    it('a DELETE resolution writes the tombstone at the reviewed version', async () => {
      await repo.resolve(tx as unknown as SyncTx, USER, GOAL_ID, {
        operation: 'DELETE',
        expectedVersion: 2,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ data }] = tx.goal.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(3);
    });
  });

  it('findOwned reads through the transaction and is ownership-scoped', async () => {
    await repo.findOwned(tx as unknown as SyncTx, USER, GOAL_ID);

    expect(tx.goal.findFirst).toHaveBeenCalledWith({
      where: { id: GOAL_ID, userId: USER },
    });
  });

  it('changedSince is the pull path and uses the root client, not a transaction', async () => {
    const root = {
      goal: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const pullRepo = new PrismaGoalRepository(root);

    await pullRepo.changedSince(USER, 5, 100);

    expect(
      (root as unknown as { goal: { findMany: jest.Mock } }).goal.findMany,
    ).toHaveBeenCalledWith({
      where: { userId: USER, syncSeq: { gt: BigInt(5) } },
      orderBy: { syncSeq: 'asc' },
      take: 100,
    });
  });
});
