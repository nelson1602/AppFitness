import type { SyncOperationInput, SyncTx } from '../../sync/domain/sync.types';
import type { WellnessSafetyProfileWriteInput } from '../domain/wellness-payload';
import {
  type WellnessResolution,
  WellnessRepositoryPort,
} from '../domain/wellness.repository';
import type {
  WellnessClock,
  WellnessSafetyProfileRecord,
} from '../domain/wellness.types';
import { WellnessSafetyProfileSyncHandler } from './wellness-safety-profile-sync.handler';

/**
 * ADR-P017 **W-2** handler behaviour.
 *
 * The fake repository records the `userId` every call received, so "ownership
 * comes only from the authenticated user" is asserted from what the handler
 * actually passed down — not from reading the SQL. It also refuses to act on a
 * row it does not own, mirroring the owner-scoped `updateMany` in the Prisma
 * implementation, which is what makes the zero-row cases meaningful.
 */

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-09-09T12:00:00.000Z');
const TX = {} as SyncTx;

interface Call {
  method: string;
  userId: string;
  id: string;
  deletedAt?: Date;
}

class FakeRepo extends WellnessRepositoryPort {
  readonly calls: Call[] = [];
  readonly rows = new Map<string, WellnessSafetyProfileRecord>();

  seed(
    record: Partial<WellnessSafetyProfileRecord> & { userId: string },
  ): void {
    const id = record.id ?? record.userId;
    const userId = record.userId;
    this.rows.set(`${userId}:${id}`, {
      ...record,
      id,
      userId,
      evaluationCompleted: record.evaluationCompleted ?? false,
      evaluationDate: record.evaluationDate ?? null,
      affectedAreas: record.affectedAreas ?? [],
      movementsToAvoid: record.movementsToAvoid ?? [],
      version: record.version ?? 1,
      syncSeq: record.syncSeq ?? 10,
      createdAt: record.createdAt ?? NOW,
      updatedAt: record.updatedAt ?? NOW,
      deletedAt: record.deletedAt ?? null,
      deletedBy: record.deletedBy ?? null,
    });
  }

  findOwned(
    _tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<WellnessSafetyProfileRecord | null> {
    this.calls.push({ method: 'findOwned', userId, id });
    return Promise.resolve(this.rows.get(`${userId}:${id}`) ?? null);
  }

  create(
    _tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
  ): Promise<number> {
    this.calls.push({ method: 'create', userId, id });
    this.seed({ userId, id, ...data });
    return Promise.resolve(1);
  }

  /** Mirrors the Prisma implementation: owner-scoped, and clears a tombstone. */
  update(
    _tx: SyncTx,
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
    expectedVersion: number,
  ): Promise<number> {
    this.calls.push({ method: 'update', userId, id });
    const key = `${userId}:${id}`;
    const existing = this.rows.get(key);
    if (!existing || existing.version !== expectedVersion)
      return Promise.resolve(0);
    this.rows.set(key, {
      ...existing,
      ...data,
      version: expectedVersion + 1,
      deletedAt: null,
      deletedBy: null,
    });
    return Promise.resolve(1);
  }

  softDelete(
    _tx: SyncTx,
    userId: string,
    id: string,
    expectedVersion: number,
    deletedAt: Date,
  ): Promise<number> {
    this.calls.push({ method: 'softDelete', userId, id, deletedAt });
    const key = `${userId}:${id}`;
    const existing = this.rows.get(key);
    if (
      !existing ||
      existing.deletedAt !== null ||
      existing.version !== expectedVersion
    )
      return Promise.resolve(0);
    // Stores exactly what the handler passed — no clock of its own.
    this.rows.set(key, {
      ...existing,
      deletedAt,
      deletedBy: userId,
      version: expectedVersion + 1,
    });
    return Promise.resolve(1);
  }

  changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WellnessSafetyProfileRecord[]> {
    this.calls.push({ method: 'changedSince', userId, id: `${sinceSeq}` });
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.userId === userId && row.syncSeq > sinceSeq)
        .sort((left, right) => left.syncSeq - right.syncSeq)
        .slice(0, limit),
    );
  }

  resolve(
    _tx: SyncTx,
    _userId: string,
    _id: string,
    _resolution: WellnessResolution,
  ): Promise<number> {
    void _tx;
    void _userId;
    void _id;
    void _resolution;
    return Promise.resolve(1);
  }
}

const clock: WellnessClock = { now: () => NOW };

function op(overrides: Partial<SyncOperationInput> = {}): SyncOperationInput {
  return {
    opId: 'op-1',
    entityType: 'wellness_safety_profiles',
    entityId: A,
    operation: 'CREATE',
    baseVersion: 0,
    payload: {
      evaluation_completed: true,
      evaluation_date: '2026-01-02',
      affected_areas: ['knee'],
      movements_to_avoid: [],
    },
    ...overrides,
  };
}

let repo: FakeRepo;
let handler: WellnessSafetyProfileSyncHandler;

beforeEach(() => {
  repo = new FakeRepo();
  handler = new WellnessSafetyProfileSyncHandler(repo, clock);
});

describe('registration surface', () => {
  it('handles exactly the wellness entity type', () => {
    expect(handler.entityType).toBe('wellness_safety_profiles');
  });

  it('exposes no conflict redactor, because the row has no free text', () => {
    expect(
      (handler as { redactForConflict?: unknown }).redactForConflict,
    ).toBeUndefined();
  });
});

describe('the singleton id must be the authenticated user', () => {
  it.each(['CREATE', 'UPDATE', 'DELETE'] as const)(
    'rejects a %s whose entityId is another user',
    async (operation) => {
      repo.seed({ userId: B });
      await expect(
        handler.apply(A, op({ operation, entityId: B, baseVersion: 1 }), TX),
      ).rejects.toThrow(/entityId must equal the authenticated user id/);
      // Nothing was even looked up, let alone written.
      expect(repo.calls).toEqual([]);
      expect(repo.rows.get(`${B}:${B}`)?.version).toBe(1);
    },
  );

  it('reports no server state for another user row', async () => {
    repo.seed({ userId: B });
    expect(await handler.getServerState(A, B, TX)).toBeNull();
    expect(await handler.getServerState(B, B, TX)).not.toBeNull();
  });
});

describe('ownership comes only from the authenticated user', () => {
  it('ignores a client-supplied user_id and id on CREATE', async () => {
    await handler.apply(
      A,
      op({
        payload: {
          id: 'attacker-chosen-id',
          user_id: B,
          evaluation_completed: false,
          evaluation_date: null,
          affected_areas: [],
          movements_to_avoid: [],
        },
      }),
      TX,
    );

    expect(
      repo.calls.map((call) => `${call.method}:${call.userId}:${call.id}`),
    ).toEqual([`create:${A}:${A}`]);
    expect(repo.rows.has(`${B}:${B}`)).toBe(false);
    expect(repo.rows.get(`${A}:${A}`)?.userId).toBe(A);
  });

  it('passes the authenticated user to every repository call', async () => {
    repo.seed({ userId: A });
    await handler.getServerState(A, A, TX);
    await handler.apply(A, op({ operation: 'UPDATE', baseVersion: 1 }), TX);
    await handler.apply(A, op({ operation: 'DELETE', baseVersion: 2 }), TX);
    await handler.pullChanges(A, 0, 10);

    expect(new Set(repo.calls.map((call) => call.userId))).toEqual(
      new Set([A]),
    );
  });
});

describe('write behaviour', () => {
  it('normalizes tokens before persisting', async () => {
    await handler.apply(
      A,
      op({
        payload: {
          evaluation_completed: false,
          evaluation_date: null,
          affected_areas: [' Knee', 'KNEE', 'ankle'],
          movements_to_avoid: ['JUMPING', 'jumping'],
        },
      }),
      TX,
    );
    const row = repo.rows.get(`${A}:${A}`);
    expect(row?.affectedAreas).toEqual(['ankle', 'knee']);
    expect(row?.movementsToAvoid).toEqual(['jumping']);
  });

  it('revives a tombstoned singleton through UPDATE, the path the device uses', async () => {
    // The id is fixed, so re-entering a profile after a delete is an UPDATE of
    // the same row. `getServerState` still reports the tombstone, so the
    // pipeline can match versions instead of rejecting it as NOT_FOUND.
    repo.seed({ userId: A, deletedAt: NOW, deletedBy: A, version: 3 });
    expect(await handler.getServerState(A, A, TX)).toMatchObject({
      version: 3,
    });

    await handler.apply(A, op({ operation: 'UPDATE', baseVersion: 3 }), TX);

    expect(repo.calls.map((call) => call.method)).toEqual([
      'findOwned',
      'update',
    ]);
    const row = repo.rows.get(`${A}:${A}`);
    expect(row?.deletedAt).toBeNull();
    expect(row?.deletedBy).toBeNull();
    expect(row?.version).toBe(4);
  });

  it('tombstones with the exact instant the injected clock returned', async () => {
    const scripted = new Date('2027-05-06T07:08:09.010Z');
    const handlerWithClock = new WellnessSafetyProfileSyncHandler(repo, {
      now: () => scripted,
    });
    repo.seed({ userId: A });

    await handlerWithClock.apply(
      A,
      op({ operation: 'DELETE', baseVersion: 1 }),
      TX,
    );

    const call = repo.calls.find((entry) => entry.method === 'softDelete');
    expect(call?.deletedAt).toBe(scripted);
    expect(repo.rows.get(`${A}:${A}`)?.deletedAt).toBe(scripted);
  });

  it('takes one clock reading per operation', async () => {
    const readings: Date[] = [];
    const ticking = new WellnessSafetyProfileSyncHandler(repo, {
      now: () => {
        const reading = new Date(NOW.getTime() + readings.length * 1000);
        readings.push(reading);
        return reading;
      },
    });
    repo.seed({ userId: A });

    await ticking.apply(A, op({ operation: 'DELETE', baseVersion: 1 }), TX);

    expect(readings).toHaveLength(1);
    expect(repo.rows.get(`${A}:${A}`)?.deletedAt).toBe(readings[0]);
  });

  it('advances the version on update and delete', async () => {
    repo.seed({ userId: A });
    await handler.apply(A, op({ operation: 'UPDATE', baseVersion: 1 }), TX);
    expect(repo.rows.get(`${A}:${A}`)?.version).toBe(2);

    await handler.apply(A, op({ operation: 'DELETE', baseVersion: 2 }), TX);
    expect(repo.rows.get(`${A}:${A}`)).toMatchObject({
      version: 3,
      deletedBy: A,
    });
  });

  it('reports STALE when an update or delete matches no owned row', async () => {
    await expect(
      handler.apply(A, op({ operation: 'UPDATE', baseVersion: 1 }), TX),
    ).resolves.toEqual({ status: 'STALE' });
    await expect(
      handler.apply(A, op({ operation: 'DELETE', baseVersion: 1 }), TX),
    ).resolves.toEqual({ status: 'STALE' });
  });

  it.each([
    ['an unknown token', { affected_areas: ['spleen'] }],
    ['a clinical narrative', { affected_areas: ['chronic lower back pain'] }],
    [
      'an inconsistent flag/date',
      { evaluation_completed: false, evaluation_date: '2026-01-02' },
    ],
    [
      'an impossible date',
      { evaluation_completed: true, evaluation_date: '2026-02-31' },
    ],
    [
      'a future date beyond the bound',
      { evaluation_completed: true, evaluation_date: '2099-01-01' },
    ],
    ['a malformed payload', { evaluation_completed: 'yes' }],
  ])('rejects %s before writing anything', async (_label, overrides) => {
    await expect(
      handler.apply(A, op({ payload: { ...op().payload, ...overrides } }), TX),
    ).rejects.toThrow();
    expect(repo.rows.size).toBe(0);
  });
});

describe('pull', () => {
  it('returns owner rows only, with tombstones and the sync cursor', async () => {
    repo.seed({ userId: A, syncSeq: 12 });
    repo.seed({ userId: B, syncSeq: 13 });

    const changes = await handler.pullChanges(A, 0, 10);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityType: 'wellness_safety_profiles',
      entityId: A,
      syncSeq: 12,
      deleted: false,
    });
    expect(changes[0].data).toMatchObject({ id: A, user_id: A });

    await handler.apply(A, op({ operation: 'DELETE', baseVersion: 1 }), TX);
    const afterDelete = await handler.pullChanges(A, 0, 10);
    expect(afterDelete[0].deleted).toBe(true);
    expect(afterDelete[0].data.deleted_at).not.toBeNull();
  });

  it('honours the incremental cursor', async () => {
    repo.seed({ userId: A, syncSeq: 12 });
    expect(await handler.pullChanges(A, 12, 10)).toEqual([]);
    expect(await handler.pullChanges(A, 11, 10)).toHaveLength(1);
  });

  it('emits a date-only calendar date and JSON token arrays', async () => {
    repo.seed({
      userId: A,
      evaluationCompleted: true,
      evaluationDate: new Date('2026-01-02T00:00:00.000Z'),
      affectedAreas: ['knee'],
      movementsToAvoid: ['jumping'],
      syncSeq: 14,
    });
    const [change] = await handler.pullChanges(A, 0, 10);
    expect(change.data.evaluation_date).toBe('2026-01-02');
    expect(change.data.affected_areas).toEqual(['knee']);
    expect(change.data.movements_to_avoid).toEqual(['jumping']);
  });
});

describe('ADR-P030 C-2 resolution-facing seams', () => {
  it('returns the owner row unredacted and forwards the reviewed tombstone state', async () => {
    repo.seed({
      userId: A,
      version: 6,
      affectedAreas: ['knee'],
      movementsToAvoid: ['jumping'],
    });
    const snapshot = await handler.readCurrentOwnedRow(A, A, TX);
    expect(snapshot).toMatchObject({
      version: 6,
      deleted: false,
      row: {
        affected_areas: ['knee'],
        movements_to_avoid: ['jumping'],
      },
    });

    const resolve = jest.spyOn(repo, 'resolve');
    await handler.resolveConflictMutation(
      A,
      A,
      {
        operation: 'DELETE',
        payload: {},
        expectedServerVersion: 6,
        expectedDeleted: false,
      },
      TX,
    );
    expect(resolve).toHaveBeenCalledWith(TX, A, A, {
      operation: 'DELETE',
      expectedVersion: 6,
      expectedDeleted: false,
      resolvedBy: A,
    });
  });
});
