import { GoalAttributes, GoalRecord } from './goal.types';

/** Repository port for goals (mirrors ProfileRepositoryPort). */
export abstract class GoalRepositoryPort {
  abstract findOwned(userId: string, id: string): Promise<GoalRecord | null>;
  abstract create(
    userId: string,
    attributes: Partial<GoalAttributes>,
    id: string,
  ): Promise<GoalRecord>;
  abstract update(
    id: string,
    attributes: Partial<GoalAttributes>,
    newVersion: number,
  ): Promise<GoalRecord>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<GoalRecord[]>;
}
