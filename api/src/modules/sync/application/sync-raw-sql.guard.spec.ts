import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { SyncOperationType } from '@prisma/client';

import { isAlreadySatisfiedDelete } from '../domain/sync.types';

const SRC = join(process.cwd(), 'src');

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionTypeScriptFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('ADR-P030 C-2 source safety boundaries', () => {
  it('contains no unsafe or dynamically composed raw SQL in production source', () => {
    const violations: string[] = [];

    for (const path of productionTypeScriptFiles(SRC)) {
      const source = readFileSync(path, 'utf8');
      for (const forbidden of [
        '$executeRawUnsafe',
        '$queryRawUnsafe',
        'Prisma.raw(',
        'Prisma.sql(',
      ]) {
        if (source.includes(forbidden)) {
          violations.push(`${relative(SRC, path)}: ${forbidden}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('uses exactly 13 static, entity-owned PK-conflict inserts', () => {
    const insertedTables: string[] = [];

    for (const path of productionTypeScriptFiles(SRC)) {
      const source = readFileSync(path, 'utf8');
      const statements = [...source.matchAll(/\$executeRaw`[\s\S]*?`/g)].map(
        ([statement]) => statement,
      );
      if (statements.length > 0) {
        for (const statement of statements) {
          expect(statement).toContain('ON CONFLICT (id) DO NOTHING');
          const target = statement.match(/INSERT INTO\s+([a-z_]+)\s*\(/);
          expect(target).not.toBeNull();
          const identifierSection = statement.slice(
            0,
            statement.indexOf('VALUES'),
          );
          expect(identifierSection).not.toContain('${');
          insertedTables.push(target?.[1] ?? 'INVALID');
        }
      }
    }

    expect(insertedTables.sort()).toEqual(
      [
        'body_measurements',
        'body_weights',
        'dietary_preferences',
        'exercises',
        'goals',
        'meal_items',
        'progress_snapshots',
        'routine_exercises',
        'routines',
        'user_profiles',
        'wellness_safety_profiles',
        'workout_logs',
        'workout_sets',
      ].sort(),
    );
  });

  it('keeps all 13 public resolution mutations from rewriting an already-reviewed tombstone', () => {
    const guardedSites = productionTypeScriptFiles(SRC)
      .filter((path) => path.endsWith('repository.ts'))
      .flatMap((path) =>
        Array.from(
          readFileSync(path, 'utf8').matchAll(
            /isAlreadySatisfiedDelete\(resolution\)/g,
          ),
        ),
      );

    expect(guardedSites).toHaveLength(13);
    expect(
      isAlreadySatisfiedDelete({
        operation: SyncOperationType.DELETE,
        expectedDeleted: true,
      }),
    ).toBe(true);
    for (const operation of [
      SyncOperationType.CREATE,
      SyncOperationType.UPDATE,
      SyncOperationType.DELETE,
    ]) {
      expect(
        isAlreadySatisfiedDelete({ operation, expectedDeleted: false }),
      ).toBe(false);
    }
  });
});
