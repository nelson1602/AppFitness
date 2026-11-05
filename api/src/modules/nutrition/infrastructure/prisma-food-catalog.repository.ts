import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  type CatalogFoodRow,
  FoodCatalogRepositoryPort,
  type NewFoodRow,
} from '../domain/food-catalog.repository';

const FOOD_SELECT = {
  id: true,
  catalogKey: true,
  foodRevision: true,
  catalogVersion: true,
  name: true,
  brand: true,
  createdBy: true,
  servingAmount: true,
  servingUnit: true,
  gramsPerServing: true,
  caloriesPerServing: true,
  proteinPerServing: true,
  carbsPerServing: true,
  fatPerServing: true,
  fiberPerServing: true,
} as const;

/**
 * Accent folding done in SQL with `translate` (no `unaccent` extension, so
 * no migration): accented Latin letters → their base letter, then `lower`.
 */
export const ACCENTED = 'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç';
export const UNACCENTED = 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc';

/** Prisma persistence for the food catalogue's REST paths (ADR-P045). */
@Injectable()
export class PrismaFoodCatalogRepository extends FoodCatalogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async searchVisible(
    userId: string,
    foldedWords: readonly string[],
    limit: number,
  ): Promise<CatalogFoodRow[]> {
    if (foldedWords.length === 0) return [];
    // Every word is a driver parameter; folded words hold only letters and
    // digits, so they carry no LIKE wildcard.
    const matches = foldedWords.map(
      (word) =>
        Prisma.sql`lower(translate(name, ${ACCENTED}, ${UNACCENTED})) LIKE ${`%${word}%`}`,
    );
    return this.prisma.$queryRaw<CatalogFoodRow[]>`
      SELECT id,
             catalog_key AS "catalogKey",
             food_revision AS "foodRevision",
             catalog_version AS "catalogVersion",
             name,
             brand,
             created_by AS "createdBy",
             serving_amount AS "servingAmount",
             serving_unit AS "servingUnit",
             grams_per_serving AS "gramsPerServing",
             calories_per_serving AS "caloriesPerServing",
             protein_per_serving AS "proteinPerServing",
             carbs_per_serving AS "carbsPerServing",
             fat_per_serving AS "fatPerServing",
             fiber_per_serving AS "fiberPerServing"
        FROM foods
       WHERE deleted_at IS NULL
         AND (created_by IS NULL OR created_by = ${userId}::uuid)
         AND ${Prisma.join(matches, ' AND ')}
       ORDER BY char_length(name), name, id
       LIMIT ${limit}
    `;
  }

  findGlobalByCatalogKeys(
    catalogKeys: readonly string[],
  ): Promise<CatalogFoodRow[]> {
    if (catalogKeys.length === 0) return Promise.resolve([]);
    return this.prisma.food.findMany({
      where: {
        catalogKey: { in: [...catalogKeys] },
        createdBy: null,
        deletedAt: null,
      },
      select: FOOD_SELECT,
    });
  }

  findById(
    id: string,
  ): Promise<(CatalogFoodRow & { deletedAt: Date | null }) | null> {
    return this.prisma.food.findUnique({
      where: { id },
      select: { ...FOOD_SELECT, deletedAt: true },
    });
  }

  async insertIfAbsent(row: NewFoodRow): Promise<void> {
    // ON CONFLICT DO NOTHING: two concurrent imports of the same item both
    // succeed and the caller re-reads the single stored revision.
    await this.prisma.food.createMany({
      data: [{ ...row, isVerified: false }],
      skipDuplicates: true,
    });
  }
}
