import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../database/prisma.service';
import {
  type CustomServingUnit,
  checkedGramsPerServing,
} from '../../nutrition/application/food-search.service';
import { deriveFoodId } from '../../nutrition/catalog/catalog-identity';
import {
  ACCENTED,
  UNACCENTED,
} from '../../nutrition/infrastructure/prisma-food-catalog.repository';
import type { StaffContext } from '../domain/staff.types';
import { StaffAuditService } from './staff-audit.service';

/** Catalogue stamp of foods added from the backoffice. */
export const STAFF_CATALOG_VERSION = 'staff@1';
export const STAFF_KEY_PREFIX = 'staff.';

/**
 * Where a global food comes from. Only `staff` and `external` foods are edited
 * here: phones always use their bundled copy of a `bundled` food, so a server
 * correction or retirement of one would never reach them (ADR-P049 amdt 1).
 */
export type FoodKind = 'bundled' | 'external' | 'staff';

export function foodKind(catalogKey: string): FoodKind {
  if (catalogKey.startsWith(STAFF_KEY_PREFIX)) return 'staff';
  if (catalogKey.startsWith('fdc.') || catalogKey.startsWith('off.')) {
    return 'external';
  }
  return 'bundled';
}

export interface CatalogFoodInput {
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: CustomServingUnit;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
}

export interface CatalogFoodView {
  id: string;
  catalogKey: string;
  foodRevision: number;
  catalogVersion: string | null;
  kind: FoodKind;
  /** `retired` hides the food from search; `superseded` = a newer revision exists. */
  status: 'active' | 'retired' | 'superseded';
  editable: boolean;
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: string;
  gramsPerServing: number | null;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fiberPerServing: number | null;
  retiredAt: string | null;
  createdAt: string;
}

export interface FoodListQuery {
  q?: string;
  kind?: FoodKind;
  status?: 'active' | 'retired';
  page: number;
  pageSize: number;
}

const FOOD_SELECT = {
  id: true,
  catalogKey: true,
  foodRevision: true,
  catalogVersion: true,
  name: true,
  brand: true,
  servingAmount: true,
  servingUnit: true,
  gramsPerServing: true,
  caloriesPerServing: true,
  proteinPerServing: true,
  carbsPerServing: true,
  fatPerServing: true,
  fiberPerServing: true,
  retiredAt: true,
  createdAt: true,
} as const;

type FoodRow = Prisma.FoodGetPayload<{ select: typeof FOOD_SELECT }>;

/** Folded words of a query (accent- and case-insensitive, letters/digits). */
function foldedWords(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

function auditFields(row: FoodRow | CatalogFoodView) {
  return {
    catalogKey: row.catalogKey,
    foodRevision: row.foodRevision,
    name: row.name,
    brand: row.brand,
    servingAmount: row.servingAmount,
    servingUnit: row.servingUnit,
    gramsPerServing: row.gramsPerServing,
    caloriesPerServing: row.caloriesPerServing,
    proteinPerServing: row.proteinPerServing,
    carbsPerServing: row.carbsPerServing,
    fatPerServing: row.fatPerServing,
    fiberPerServing: row.fiberPerServing,
  };
}

/**
 * Backoffice catalogue management (ADR-P049 amendment 1). Global foods only —
 * a person's private custom foods never appear here. Revisions stay
 * immutable (ADR-P012): a correction adds the next revision and retires the
 * previous one; retiring hides a food from search and import but never
 * deletes it, so meal items that reference any revision keep syncing.
 * Exercises are read-only until phones can download catalogue updates.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: StaffAuditService,
  ) {}

  async listFoods(query: FoodListQuery) {
    const words = foldedWords(query.q);
    const filters: Prisma.Sql[] = [
      Prisma.sql`created_by IS NULL`,
      Prisma.sql`deleted_at IS NULL`,
      Prisma.sql`catalog_key IS NOT NULL`,
      ...words.map(
        (word) =>
          Prisma.sql`lower(translate(name, ${ACCENTED}, ${UNACCENTED})) LIKE ${`%${word}%`}`,
      ),
    ];
    if (query.kind === 'staff') {
      filters.push(Prisma.sql`catalog_key LIKE 'staff.%'`);
    } else if (query.kind === 'external') {
      filters.push(
        Prisma.sql`(catalog_key LIKE 'fdc.%' OR catalog_key LIKE 'off.%')`,
      );
    } else if (query.kind === 'bundled') {
      filters.push(
        Prisma.sql`catalog_key NOT LIKE 'staff.%' AND catalog_key NOT LIKE 'fdc.%' AND catalog_key NOT LIKE 'off.%'`,
      );
    }
    const statusFilter =
      query.status === 'active'
        ? Prisma.sql`WHERE retired_at IS NULL`
        : query.status === 'retired'
          ? Prisma.sql`WHERE retired_at IS NOT NULL`
          : Prisma.empty;
    // One row per catalogue key: its newest revision. Name filters apply to
    // any revision's name only through that newest row.
    const current = Prisma.sql`
      SELECT DISTINCT ON (catalog_key) id, catalog_key, food_revision, name, retired_at
        FROM foods
       WHERE ${Prisma.join(filters, ' AND ')}
       ORDER BY catalog_key, food_revision DESC`;
    const offset = (query.page - 1) * query.pageSize;
    const [ids, totals] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM (${current}) AS c ${statusFilter}
         ORDER BY lower(name), catalog_key
         LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM (${current}) AS c ${statusFilter}`,
    ]);
    const rows = await this.prisma.food.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      select: FOOD_SELECT,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids
      .map((row) => byId.get(row.id))
      .filter((row): row is FoodRow => row !== undefined)
      .map((row) => this.view(row, true));
    return {
      items,
      total: Number(totals[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** One food and every revision of its catalogue key, newest first. */
  async getFood(id: string) {
    const row = await this.globalFood(id);
    const revisions = await this.prisma.food.findMany({
      where: { catalogKey: row.catalogKey, createdBy: null, deletedAt: null },
      orderBy: { foodRevision: 'desc' },
      select: FOOD_SELECT,
    });
    const newest = revisions[0]?.foodRevision ?? row.foodRevision;
    return {
      food: this.view(row, row.foodRevision === newest),
      revisions: revisions.map((rev) =>
        this.view(rev, rev.foodRevision === newest),
      ),
    };
  }

  async createFood(actor: StaffContext, input: CatalogFoodInput) {
    const gramsPerServing = checkedGramsPerServing(input);
    const catalogKey = `${STAFF_KEY_PREFIX}${randomUUID()}`;
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.food.create({
        data: {
          ...input,
          gramsPerServing,
          id: deriveFoodId(catalogKey, 1),
          catalogKey,
          foodRevision: 1,
          catalogVersion: STAFF_CATALOG_VERSION,
          createdBy: null,
          isVerified: true,
        },
        select: FOOD_SELECT,
      });
      await this.audit.record(
        {
          action: 'catalog.food_create',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'food',
          targetId: row.id,
          after: auditFields(row),
          ip: actor.ip,
        },
        tx,
      );
      return row;
    });
    return this.view(created, true);
  }

  /**
   * A correction: the next revision under the same key, with the previous one
   * retired in the same transaction. `id` must be the current revision.
   */
  async reviseFood(actor: StaffContext, id: string, input: CatalogFoodInput) {
    const gramsPerServing = checkedGramsPerServing(input);
    const previous = await this.editableCurrent(id);
    const catalogKey = previous.catalogKey as string;
    const nextRevision = previous.foodRevision + 1;
    try {
      const revised = await this.prisma.$transaction(async (tx) => {
        const retired = await tx.food.updateMany({
          where: { id: previous.id, retiredAt: null, deletedAt: null },
          data: { retiredAt: new Date(), retiredByStaffId: actor.id },
        });
        if (retired.count !== 1) throw new FoodChangedError();
        const row = await tx.food.create({
          data: {
            ...input,
            gramsPerServing,
            id: deriveFoodId(catalogKey, nextRevision),
            catalogKey,
            foodRevision: nextRevision,
            catalogVersion: previous.catalogVersion,
            createdBy: null,
            isVerified: true,
          },
          select: FOOD_SELECT,
        });
        await this.audit.record(
          {
            action: 'catalog.food_revise',
            staffId: actor.id,
            staffEmail: actor.email,
            targetType: 'food',
            targetId: row.id,
            before: { id: previous.id, ...auditFields(previous) },
            after: { id: row.id, ...auditFields(row) },
            ip: actor.ip,
          },
          tx,
        );
        return row;
      });
      return this.view(revised, true);
    } catch (error) {
      if (
        error instanceof FoodChangedError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        throw new ConflictException(
          'This food changed meanwhile; reload it and try again',
        );
      }
      throw error;
    }
  }

  /** Hides the current revision from search and import (never a delete). */
  async retireFood(actor: StaffContext, id: string) {
    const current = await this.editableCurrent(id);
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.food.updateMany({
        where: { id: current.id, retiredAt: null, deletedAt: null },
        data: { retiredAt: now, retiredByStaffId: actor.id },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'This food changed meanwhile; reload it and try again',
        );
      }
      await this.audit.record(
        {
          action: 'catalog.food_retire',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'food',
          targetId: current.id,
          before: { retiredAt: null },
          after: { retiredAt: now.toISOString() },
          ip: actor.ip,
        },
        tx,
      );
      return { ...current, retiredAt: now };
    });
    return this.view(row, true);
  }

  /** Shows a retired food again; only its newest revision can come back. */
  async restoreFood(actor: StaffContext, id: string) {
    const row = await this.globalFood(id);
    this.assertEditableKind(row);
    if (row.retiredAt === null) {
      throw new ConflictException('This food is not retired');
    }
    await this.assertNewest(row);
    const restored = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.food.updateMany({
        where: { id: row.id, retiredAt: { not: null }, deletedAt: null },
        data: { retiredAt: null, retiredByStaffId: null },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'This food changed meanwhile; reload it and try again',
        );
      }
      await this.audit.record(
        {
          action: 'catalog.food_restore',
          staffId: actor.id,
          staffEmail: actor.email,
          targetType: 'food',
          targetId: row.id,
          before: { retiredAt: row.retiredAt?.toISOString() ?? null },
          after: { retiredAt: null },
          ip: actor.ip,
        },
        tx,
      );
      return { ...row, retiredAt: null };
    });
    return this.view(restored, true);
  }

  /** The global exercise catalogue, read-only. */
  async listExercises(query: { q?: string; page: number; pageSize: number }) {
    const where: Prisma.ExerciseWhereInput = {
      createdBy: null,
      deletedAt: null,
      ...(query.q
        ? { name: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          muscleGroup: true,
          category: true,
          instructions: true,
        },
      }),
      this.prisma.exercise.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  private async globalFood(id: string): Promise<FoodRow> {
    const row = await this.prisma.food.findFirst({
      where: {
        id,
        createdBy: null,
        deletedAt: null,
        catalogKey: { not: null },
      },
      select: FOOD_SELECT,
    });
    if (!row) throw new NotFoundException('Food not found');
    return row;
  }

  private assertEditableKind(row: FoodRow): void {
    if (foodKind(row.catalogKey as string) === 'bundled') {
      throw new BadRequestException(
        'Built-in foods ship inside the app; they change with an app release',
      );
    }
  }

  private async assertNewest(row: FoodRow): Promise<void> {
    const newer = await this.prisma.food.count({
      where: {
        catalogKey: row.catalogKey,
        createdBy: null,
        foodRevision: { gt: row.foodRevision },
      },
    });
    if (newer > 0) {
      throw new ConflictException(
        'A newer revision of this food exists; edit that one',
      );
    }
  }

  /** A staff or external food's newest revision, not retired. */
  private async editableCurrent(id: string): Promise<FoodRow> {
    const row = await this.globalFood(id);
    this.assertEditableKind(row);
    await this.assertNewest(row);
    if (row.retiredAt !== null) {
      throw new ConflictException('Restore this food before changing it');
    }
    return row;
  }

  private view(row: FoodRow, newest: boolean): CatalogFoodView {
    const catalogKey = row.catalogKey as string;
    const kind = foodKind(catalogKey);
    const status = !newest
      ? 'superseded'
      : row.retiredAt !== null
        ? 'retired'
        : 'active';
    return {
      id: row.id,
      catalogKey,
      foodRevision: row.foodRevision,
      catalogVersion: row.catalogVersion,
      kind,
      status,
      editable: kind !== 'bundled' && newest,
      name: row.name,
      brand: row.brand,
      servingAmount: row.servingAmount,
      servingUnit: row.servingUnit,
      gramsPerServing: row.gramsPerServing,
      caloriesPerServing: row.caloriesPerServing,
      proteinPerServing: row.proteinPerServing,
      carbsPerServing: row.carbsPerServing,
      fatPerServing: row.fatPerServing,
      fiberPerServing: row.fiberPerServing,
      retiredAt: row.retiredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

class FoodChangedError extends Error {}
