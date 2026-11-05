import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../database/prisma.service';
import { foldText } from '../catalog/external-food';
import {
  ACCENTED,
  PrismaFoodCatalogRepository,
  UNACCENTED,
} from './prisma-food-catalog.repository';

const USER = '11111111-1111-4111-8111-111111111111';

function fakePrisma(): {
  $queryRaw: jest.Mock;
  food: { findMany: jest.Mock; findUnique: jest.Mock; createMany: jest.Mock };
} {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    food: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('PrismaFoodCatalogRepository (ADR-P045)', () => {
  it('the SQL accent table maps each accented letter to its folded base', () => {
    expect([...ACCENTED]).toHaveLength([...UNACCENTED].length);
    [...ACCENTED].forEach((letter, i) => {
      expect(foldText(letter)).toBe([...UNACCENTED][i].toLowerCase());
    });
  });

  it('searchVisible filters active, global-or-own foods and matches every word as a parameter', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaFoodCatalogRepository(
      prisma as unknown as PrismaService,
    );

    await repo.searchVisible(USER, ['chicharron', 'cerdo'], 15);

    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join('?');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('created_by IS NULL OR created_by = ?::uuid');
    expect(sql).toContain('LIMIT ?');
    expect(values[0]).toBe(USER);
    // The word conditions are a Prisma.Sql fragment with bound values only.
    const fragment = values[1] as Prisma.Sql;
    expect(fragment.values).toEqual([
      ACCENTED,
      UNACCENTED,
      '%chicharron%',
      ACCENTED,
      UNACCENTED,
      '%cerdo%',
    ]);
    expect(fragment.sql).toContain(' AND ');
    expect(values[2]).toBe(15);
  });

  it('searchVisible without words never queries', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaFoodCatalogRepository(
      prisma as unknown as PrismaService,
    );
    await expect(repo.searchVisible(USER, [], 15)).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('findGlobalByCatalogKeys only reads active global foods', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaFoodCatalogRepository(
      prisma as unknown as PrismaService,
    );

    await repo.findGlobalByCatalogKeys(['off.123', 'fdc.9']);

    const [{ where }] = prisma.food.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(where).toEqual({
      catalogKey: { in: ['off.123', 'fdc.9'] },
      createdBy: null,
      deletedAt: null,
    });
  });

  it('insertIfAbsent is ON CONFLICT DO NOTHING and never verified', async () => {
    const prisma = fakePrisma();
    const repo = new PrismaFoodCatalogRepository(
      prisma as unknown as PrismaService,
    );

    await repo.insertIfAbsent({
      id: 'id',
      catalogKey: 'off.123',
      foodRevision: 1,
      catalogVersion: 'external@1',
      name: 'Chicharrón de cerdo',
      brand: null,
      createdBy: null,
      servingAmount: 100,
      servingUnit: 'g',
      gramsPerServing: 100,
      caloriesPerServing: 544,
      proteinPerServing: 61.3,
      carbsPerServing: 0,
      fatPerServing: 31.3,
      fiberPerServing: 0,
    });

    const [args] = prisma.food.createMany.mock.calls[0] as [
      { data: Array<{ isVerified: boolean }>; skipDuplicates: boolean },
    ];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data[0].isVerified).toBe(false);
  });
});
