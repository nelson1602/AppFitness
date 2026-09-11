import type { PrismaService } from '../../database/prisma.service';
import type { SyncTx } from '../../sync/domain/sync.types';
import { PROFILE_DEFAULTS } from '../domain/profile.types';
import { PrismaProfileRepository } from './prisma-profile.repository';

const USER = 'user-1';
const PROFILE_ID = '33333333-3333-4333-8333-333333333333';

type FakeTx = {
  $executeRaw: jest.Mock;
  userProfile: { findFirst: jest.Mock; updateMany: jest.Mock };
};

function fakeTx(): FakeTx {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    userProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

/**
 * A root client that throws on any model access. ADR-P030 §Decision 3: no
 * transaction-scoped helper may fall back to it. The REST methods, which are
 * deliberately unchanged by C-2, get a real stub of their own.
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

describe('PrismaProfileRepository (ADR-P030 C-2)', () => {
  let tx: FakeTx;
  let repo: PrismaProfileRepository;

  beforeEach(() => {
    tx = fakeTx();
    repo = new PrismaProfileRepository(forbiddenRoot());
  });

  describe('createForSync', () => {
    it('is a static statement with ON CONFLICT (id) DO NOTHING', async () => {
      await repo.createForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        PROFILE_DEFAULTS,
      );

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).toContain('INSERT INTO user_profiles');
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    });

    it('omits the database-owned columns and writes updated_at explicitly', async () => {
      await repo.createForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        PROFILE_DEFAULTS,
      );

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).not.toContain('created_at');
      expect(sql).not.toContain('sync_seq');
      expect(sql).not.toMatch(/\bversion\b/);
      expect(sql).toContain('updated_at');
    });

    it('casts the enum, date-only and JSONB columns so the raw row matches Prisma', async () => {
      await repo.createForSync(tx as unknown as SyncTx, USER, PROFILE_ID, {
        ...PROFILE_DEFAULTS,
        birthDate: '1990-01-15',
        gender: 'FEMALE',
        equipment: ['dumbbells', 'bands'],
      });

      const sql = sqlOf(tx.$executeRaw);
      expect(sql).toContain('::date');
      expect(sql).toContain('::"Gender"');
      expect(sql).toContain('::"FitnessLevel"');
      expect(sql).toContain('::"ActivityLevel"');
      expect(sql).toContain('::jsonb');

      const values = valuesOf(tx.$executeRaw);
      expect(values[2]).toBe('1990-01-15'); // birth_date stays a calendar day
      expect(values[3]).toBe('FEMALE');
      expect(values[11]).toBe(JSON.stringify(['dumbbells', 'bands']));
    });

    it('writes the complete representation the handler supplies, defaults included', async () => {
      await repo.createForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        PROFILE_DEFAULTS,
      );

      const values = valuesOf(tx.$executeRaw);
      expect(values[0]).toBe(PROFILE_ID);
      expect(values[1]).toBe(USER);
      expect(values[5]).toBe('INTERMEDIATE'); // fitness_level default
      expect(values[6]).toBe(0); // years_training default
      expect(values[7]).toBe('MODERATE'); // activity_level default
      expect(values[12]).toBe(3); // training_days_per_week default
      expect(values[13]).toBe(60); // session_duration_mins default
      expect(values[18]).toBeInstanceOf(Date); // updated_at
    });

    it('returns 0 on a primary-key collision without raising', async () => {
      tx.$executeRaw.mockResolvedValue(0);

      await expect(
        repo.createForSync(
          tx as unknown as SyncTx,
          USER,
          PROFILE_ID,
          PROFILE_DEFAULTS,
        ),
      ).resolves.toBe(0);
    });
  });

  describe('conditional writes', () => {
    it('updateForSync asserts owner + expected version + a live row', async () => {
      const count = await repo.updateForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        { heightCm: 181 },
        4,
      );

      expect(count).toBe(1);
      expect(tx.userProfile.updateMany).toHaveBeenCalledWith({
        where: { id: PROFILE_ID, userId: USER, version: 4, deletedAt: null },
        data: { heightCm: 181, version: 5 },
      });
    });

    it('updateForSync leaves omitted attributes untouched but honours explicit nulls', async () => {
      await repo.updateForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        { occupation: null },
        4,
      );

      const [{ data }] = tx.userProfile.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(Object.keys(data).sort()).toEqual(['occupation', 'version']);
      expect(data.occupation).toBeNull();
    });

    it('updateForSync reports 0 when the predicate matches nothing', async () => {
      tx.userProfile.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.updateForSync(tx as unknown as SyncTx, USER, PROFILE_ID, {}, 4),
      ).resolves.toBe(0);
    });

    it('softDeleteForSync carries owner + expected version + a live row', async () => {
      await repo.softDeleteForSync(
        tx as unknown as SyncTx,
        USER,
        PROFILE_ID,
        USER,
        4,
      );

      const [{ where, data }] = tx.userProfile.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: PROFILE_ID,
        userId: USER,
        version: 4,
        deletedAt: null,
      });
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(5);
    });
  });

  describe('resolveForSync', () => {
    it('requires a live row when the reviewed row was not a tombstone', async () => {
      await repo.resolveForSync(tx as unknown as SyncTx, USER, PROFILE_ID, {
        operation: 'UPDATE',
        attributes: { heightCm: 190 },
        expectedVersion: 7,
        expectedDeleted: false,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.userProfile.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({
        id: PROFILE_ID,
        userId: USER,
        version: 7,
        deletedAt: null,
      });
      expect(data).not.toHaveProperty('deletedAt');
    });

    it('requires a tombstone and restores it when the reviewed row was deleted', async () => {
      await repo.resolveForSync(tx as unknown as SyncTx, USER, PROFILE_ID, {
        operation: 'UPDATE',
        attributes: { heightCm: 190 },
        expectedVersion: 7,
        expectedDeleted: true,
        resolvedBy: USER,
      });

      const [{ where, data }] = tx.userProfile.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where.deletedAt).toEqual({ not: null });
      expect(data.deletedAt).toBeNull();
      expect(data.deletedBy).toBeNull();
    });
  });

  it('findOwnedForSync reads through the transaction and is ownership-scoped', async () => {
    await repo.findOwnedForSync(tx as unknown as SyncTx, USER, PROFILE_ID);

    expect(tx.userProfile.findFirst).toHaveBeenCalledWith({
      where: { id: PROFILE_ID, userId: USER },
    });
  });

  describe('the REST path is unchanged by C-2', () => {
    const rootRow = {
      id: PROFILE_ID,
      userId: USER,
      birthDate: null,
      gender: null,
      heightCm: 180,
      fitnessLevel: 'INTERMEDIATE',
      yearsTraining: 0,
      activityLevel: 'MODERATE',
      occupation: null,
      sleepHoursBaseline: null,
      stressLevelBaseline: null,
      equipment: [],
      trainingDaysPerWeek: 3,
      sessionDurationMins: 60,
      targetCalories: null,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
      version: 1,
      syncSeq: BigInt(1),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    function rootStub() {
      return {
        userProfile: {
          create: jest.fn().mockResolvedValue(rootRow),
          update: jest.fn().mockResolvedValue(rootRow),
          findFirst: jest.fn().mockResolvedValue(rootRow),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
    }

    it('create still writes on the root client with no version predicate', async () => {
      const root = rootStub();
      const restRepo = new PrismaProfileRepository(
        root as unknown as PrismaService,
      );

      await restRepo.create(USER, { heightCm: 180 }, PROFILE_ID);

      const [{ data }] = root.userProfile.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).toMatchObject({ id: PROFILE_ID, userId: USER });
      expect(data).not.toHaveProperty('version');
    });

    it('update still targets the id alone and sets the caller-supplied version', async () => {
      const root = rootStub();
      const restRepo = new PrismaProfileRepository(
        root as unknown as PrismaService,
      );

      await restRepo.update(PROFILE_ID, { heightCm: 181 }, 9);

      expect(root.userProfile.update).toHaveBeenCalledWith({
        where: { id: PROFILE_ID },
        data: { heightCm: 181, version: 9 },
      });
    });

    it('softDelete still targets the id alone', async () => {
      const root = rootStub();
      const restRepo = new PrismaProfileRepository(
        root as unknown as PrismaService,
      );

      await restRepo.softDelete(PROFILE_ID, USER, 9);

      const [{ where, data }] = root.userProfile.update.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ];
      expect(where).toEqual({ id: PROFILE_ID });
      expect(data.deletedBy).toBe(USER);
      expect(data.version).toBe(9);
    });
  });
});
