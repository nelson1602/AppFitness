import type { PrismaService } from '../../database/prisma.service';
import { PrismaWorkoutRepository } from './prisma-workout.repository';

/**
 * Repository-level SQL-shape checks for the custom-exercise methods (ADR-P015
 * Slice 3B), verifying ownership isolation against a mocked Prisma client
 * without a live database:
 *  - reads/writes are scoped by `created_by = userId`, so a built-in
 *    (created_by null) or another user's row can never be read or mutated;
 *  - `created_by` on CREATE is the authenticated user, never the payload;
 *  - soft-delete writes only `deleted_at` (+ version) — the exercises table
 *    has no `deleted_by` column.
 */

const USER = 'user-1';
const EX_ID = '33333333-3333-4333-8333-333333333333';

const row = {
  id: EX_ID,
  createdBy: USER,
  name: 'Zercher Squat',
  muscleGroup: 'legs',
  category: 'STRENGTH',
  instructions: null,
  version: 1,
  syncSeq: BigInt(7),
  createdAt: new Date('2026-07-21T00:00:00Z'),
  updatedAt: new Date('2026-07-21T00:00:00Z'),
  deletedAt: null,
};

function makePrisma() {
  return {
    exercise: {
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([row]),
    },
  };
}

let prisma: ReturnType<typeof makePrisma>;
let repo: PrismaWorkoutRepository;
beforeEach(() => {
  prisma = makePrisma();
  repo = new PrismaWorkoutRepository(prisma as unknown as PrismaService);
});

describe('PrismaWorkoutRepository — custom exercises', () => {
  it('findOwnedExercise scopes by id + created_by (excludes built-ins and foreign rows)', async () => {
    await repo.findOwnedExercise(USER, EX_ID);
    expect(prisma.exercise.findFirst).toHaveBeenCalledWith({
      where: { id: EX_ID, createdBy: USER },
    });
  });

  it('createExercise sets created_by from the authenticated user', async () => {
    await repo.createExercise(USER, EX_ID, {
      name: 'Zercher Squat',
      muscleGroup: 'legs',
      category: 'STRENGTH',
      instructions: null,
    });
    const arg = (prisma.exercise.create.mock.calls as unknown[][])[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.createdBy).toBe(USER);
    expect(arg.data.id).toBe(EX_ID);
  });

  it('updateExercise only ever touches the owner’s custom row (created_by scoping)', async () => {
    await repo.updateExercise(
      USER,
      EX_ID,
      {
        name: 'Front Squat',
        muscleGroup: 'legs',
        category: 'STRENGTH',
        instructions: null,
      },
      2,
    );
    const arg = (
      prisma.exercise.updateMany.mock.calls as unknown[][]
    )[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: EX_ID, createdBy: USER });
    expect(arg.data.version).toBe(2);
  });

  it('softDeleteExercise sets deleted_at + version and NO deleted_by, owner-scoped', async () => {
    await repo.softDeleteExercise(USER, EX_ID, 3);
    const arg = (
      prisma.exercise.updateMany.mock.calls as unknown[][]
    )[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: EX_ID, createdBy: USER });
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
    expect(arg.data.version).toBe(3);
    expect(arg.data).not.toHaveProperty('deletedBy');
  });

  it('exercisesChangedSince pulls only the user’s own custom exercises', async () => {
    await repo.exercisesChangedSince(USER, 5, 100);
    const arg = (prisma.exercise.findMany.mock.calls as unknown[][])[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({ createdBy: USER });
  });
});
