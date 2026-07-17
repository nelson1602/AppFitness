import { SYNC_ERROR_CODES, SyncApplyError } from '../../sync/domain/sync.types';
import type { SyncOperationInput } from '../../sync/domain/sync.types';
import { SyncEntityRegistry } from '../../sync/domain/sync-entity-registry';
import type { WorkoutRepositoryPort } from '../domain/workout.repository';
import type {
  RoutineExerciseRecord,
  RoutineRecord,
  WorkoutLogRecord,
} from '../domain/workout.types';
import { RoutineExerciseSyncHandler } from './routine-exercise-sync.handler';
import { RoutineSyncHandler } from './routine-sync.handler';
import { WorkoutLogSyncHandler } from './workout-log-sync.handler';
import { WorkoutSetSyncHandler } from './workout-set-sync.handler';

const USER = 'user-1';
const OTHER = 'user-2';
const ROUTINE_ID = '11111111-1111-4111-8111-111111111111';
const RX_ID = '22222222-2222-4222-8222-222222222222';
const EX_ID = '33333333-3333-4333-8333-333333333333';
const LOG_ID = '44444444-4444-4444-8444-444444444444';
const SET_ID = '55555555-5555-4555-8555-555555555555';

// jest.Mock fields (not jest.Mocked<T>) so mock references don't trip the
// unbound-method rule — the meal_items spec idiom.
type MockRepo = { [K in keyof WorkoutRepositoryPort]: jest.Mock };

function makeRepo(): MockRepo {
  return {
    findExercise: jest.fn(),
    findOwnedRoutine: jest.fn(),
    createRoutine: jest.fn(),
    updateRoutine: jest.fn(),
    softDeleteRoutine: jest.fn(),
    routinesChangedSince: jest.fn(),
    findRoutineParent: jest.fn(),
    findOwnedRoutineExercise: jest.fn(),
    createRoutineExercise: jest.fn(),
    updateRoutineExercise: jest.fn(),
    softDeleteRoutineExercise: jest.fn(),
    routineExercisesChangedSince: jest.fn(),
    findOwnedWorkoutLog: jest.fn(),
    createWorkoutLog: jest.fn(),
    updateWorkoutLog: jest.fn(),
    softDeleteWorkoutLog: jest.fn(),
    workoutLogsChangedSince: jest.fn(),
    findWorkoutLogParent: jest.fn(),
    findOwnedWorkoutSet: jest.fn(),
    createWorkoutSet: jest.fn(),
    updateWorkoutSet: jest.fn(),
    softDeleteWorkoutSet: jest.fn(),
    workoutSetsChangedSince: jest.fn(),
  };
}

const asPort = (r: MockRepo): WorkoutRepositoryPort => r;

const op = (o: Partial<SyncOperationInput> = {}): SyncOperationInput => ({
  opId: 'op-1',
  entityType: 'x',
  entityId: ROUTINE_ID,
  operation: 'CREATE',
  baseVersion: 0,
  payload: {},
  ...o,
});

const routineRec = (o: Partial<RoutineRecord> = {}): RoutineRecord => ({
  id: ROUTINE_ID,
  userId: USER,
  name: 'Push day',
  description: null,
  version: 2,
  syncSeq: 10,
  createdAt: new Date('2026-07-17T00:00:00Z'),
  updatedAt: new Date('2026-07-17T00:00:00Z'),
  deletedAt: null,
  ...o,
});

let repo: MockRepo;
beforeEach(() => {
  repo = makeRepo();
});

describe('RoutineSyncHandler', () => {
  it('creates / updates / soft-deletes a routine (no parent dependency)', async () => {
    const h = new RoutineSyncHandler(asPort(repo));

    await h.apply(
      USER,
      op({ operation: 'CREATE', payload: { name: 'Push day' } }),
    );
    expect(repo.createRoutine).toHaveBeenCalledWith(USER, ROUTINE_ID, {
      name: 'Push day',
      description: null,
    });

    await h.apply(
      USER,
      op({
        operation: 'UPDATE',
        baseVersion: 2,
        payload: { name: 'Pull day' },
      }),
    );
    expect(repo.updateRoutine).toHaveBeenCalledWith(
      ROUTINE_ID,
      { name: 'Pull day', description: null },
      3,
    );

    await h.apply(USER, op({ operation: 'DELETE', baseVersion: 3 }));
    expect(repo.softDeleteRoutine).toHaveBeenCalledWith(ROUTINE_ID, USER, 4);
  });

  it('rejects a routine CREATE with no name', async () => {
    const h = new RoutineSyncHandler(asPort(repo));
    await expect(
      h.apply(USER, op({ operation: 'CREATE', payload: {} })),
    ).rejects.toThrow(/name/);
  });

  it('getServerState is owner-scoped and returns version + snapshot for conflict detection', async () => {
    const h = new RoutineSyncHandler(asPort(repo));
    repo.findOwnedRoutine.mockResolvedValue(routineRec({ version: 7 }));
    const state = await h.getServerState(USER, ROUTINE_ID);
    expect(repo.findOwnedRoutine).toHaveBeenCalledWith(USER, ROUTINE_ID);
    expect(state?.version).toBe(7);
    expect(state?.snapshot).toMatchObject({ id: ROUTINE_ID, name: 'Push day' });

    repo.findOwnedRoutine.mockResolvedValue(null); // not owned → no state
    expect(await h.getServerState(OTHER, ROUTINE_ID)).toBeNull();
  });
});

describe('RoutineExerciseSyncHandler — dependencies', () => {
  const rxPayload = {
    routine_id: ROUTINE_ID,
    exercise_id: EX_ID,
    order_index: 0,
  };

  it('DEPENDENCY_NOT_READY when the parent routine has not synced', async () => {
    const h = new RoutineExerciseSyncHandler(asPort(repo));
    repo.findRoutineParent.mockResolvedValue(null);
    repo.findExercise.mockResolvedValue({ createdBy: null, deletedAt: null });

    const err = await h
      .apply(
        USER,
        op({ entityId: RX_ID, operation: 'CREATE', payload: rxPayload }),
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncApplyError);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
    );
    expect((err as SyncApplyError).retryable).toBe(true);
    expect(repo.createRoutineExercise).not.toHaveBeenCalled();
  });

  it('DEPENDENCY_NOT_READY when the referenced exercise is absent', async () => {
    const h = new RoutineExerciseSyncHandler(asPort(repo));
    repo.findRoutineParent.mockResolvedValue({ userId: USER, deletedAt: null });
    repo.findExercise.mockResolvedValue(null);

    const err = await h
      .apply(
        USER,
        op({ entityId: RX_ID, operation: 'CREATE', payload: rxPayload }),
      )
      .catch((e: unknown) => e);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
    );
  });

  it('hard-rejects when the parent routine belongs to another user', async () => {
    const h = new RoutineExerciseSyncHandler(asPort(repo));
    repo.findRoutineParent.mockResolvedValue({
      userId: OTHER,
      deletedAt: null,
    });
    repo.findExercise.mockResolvedValue({ createdBy: null, deletedAt: null });
    await expect(
      h.apply(
        USER,
        op({ entityId: RX_ID, operation: 'CREATE', payload: rxPayload }),
      ),
    ).rejects.toThrow(/not an active routine/);
  });

  it('rejects another user’s custom exercise but allows a global built-in', async () => {
    const h = new RoutineExerciseSyncHandler(asPort(repo));
    repo.findRoutineParent.mockResolvedValue({ userId: USER, deletedAt: null });

    repo.findExercise.mockResolvedValue({ createdBy: OTHER, deletedAt: null });
    await expect(
      h.apply(
        USER,
        op({ entityId: RX_ID, operation: 'CREATE', payload: rxPayload }),
      ),
    ).rejects.toThrow(/not owned by this user/);

    repo.findExercise.mockResolvedValue({ createdBy: null, deletedAt: null }); // global
    await h.apply(
      USER,
      op({ entityId: RX_ID, operation: 'CREATE', payload: rxPayload }),
    );
    expect(repo.createRoutineExercise).toHaveBeenCalledWith(USER, RX_ID, {
      routineId: ROUTINE_ID,
      exerciseId: EX_ID,
      order: 0,
      targetSets: null,
      targetReps: null,
      targetWeightKg: null,
    });
  });

  it('maps order_index ↔ order on the wire', async () => {
    const h = new RoutineExerciseSyncHandler(asPort(repo));
    const rec: RoutineExerciseRecord = {
      id: RX_ID,
      userId: USER,
      routineId: ROUTINE_ID,
      exerciseId: EX_ID,
      order: 3,
      targetSets: 4,
      targetReps: 8,
      targetWeightKg: 60,
      version: 1,
      syncSeq: 12,
      createdAt: new Date('2026-07-17T00:00:00Z'),
      updatedAt: new Date('2026-07-17T00:00:00Z'),
      deletedAt: null,
    };
    repo.routineExercisesChangedSince.mockResolvedValue([rec]);
    const [change] = await h.pullChanges(USER, 0, 100);
    expect(change.data.order_index).toBe(3);
    expect(change.data).not.toHaveProperty('order');
  });
});

describe('WorkoutLogSyncHandler — optional routine dependency', () => {
  const base = {
    name: 'Morning session',
    started_at: '2026-07-17T06:00:00.000Z',
  };

  it('creates an ad-hoc log with no routine (routine_id null)', async () => {
    const h = new WorkoutLogSyncHandler(asPort(repo));
    await h.apply(
      USER,
      op({ entityId: LOG_ID, operation: 'CREATE', payload: base }),
    );
    expect(repo.findRoutineParent).not.toHaveBeenCalled();
    expect(repo.createWorkoutLog).toHaveBeenCalled();
  });

  it('DEPENDENCY_NOT_READY when a referenced routine has not synced', async () => {
    const h = new WorkoutLogSyncHandler(asPort(repo));
    repo.findRoutineParent.mockResolvedValue(null);
    const err = await h
      .apply(
        USER,
        op({
          entityId: LOG_ID,
          operation: 'CREATE',
          payload: { ...base, routine_id: ROUTINE_ID },
        }),
      )
      .catch((e: unknown) => e);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
    );
  });

  it('redacts free-text notes from the conflict snapshot but not structured fields', async () => {
    const h = new WorkoutLogSyncHandler(asPort(repo));
    const rec: WorkoutLogRecord = {
      id: LOG_ID,
      userId: USER,
      routineId: null,
      name: 'Morning session',
      notes: 'felt a twinge in my knee',
      startedAt: new Date('2026-07-17T06:00:00Z'),
      finishedAt: null,
      version: 1,
      syncSeq: 5,
      createdAt: new Date('2026-07-17T06:00:00Z'),
      updatedAt: new Date('2026-07-17T06:00:00Z'),
      deletedAt: null,
    };
    repo.findOwnedWorkoutLog.mockResolvedValue(rec);
    const state = await h.getServerState(USER, LOG_ID);
    expect(state?.snapshot.notes).toBe('[REDACTED]');
    expect(state?.snapshot.name).toBe('Morning session');
  });
});

describe('WorkoutSetSyncHandler — dependencies', () => {
  const setPayload = {
    workout_log_id: LOG_ID,
    exercise_id: EX_ID,
    set_number: 1,
    reps: 5,
  };

  it('DEPENDENCY_NOT_READY when the parent workout_log has not synced', async () => {
    const h = new WorkoutSetSyncHandler(asPort(repo));
    repo.findWorkoutLogParent.mockResolvedValue(null);
    repo.findExercise.mockResolvedValue({ createdBy: null, deletedAt: null });
    const err = await h
      .apply(
        USER,
        op({ entityId: SET_ID, operation: 'CREATE', payload: setPayload }),
      )
      .catch((e: unknown) => e);
    expect((err as SyncApplyError).errorCode).toBe(
      SYNC_ERROR_CODES.DEPENDENCY_NOT_READY,
    );
  });

  it('creates a set once both parent log and exercise are present', async () => {
    const h = new WorkoutSetSyncHandler(asPort(repo));
    repo.findWorkoutLogParent.mockResolvedValue({
      userId: USER,
      deletedAt: null,
    });
    repo.findExercise.mockResolvedValue({ createdBy: null, deletedAt: null });
    await h.apply(
      USER,
      op({ entityId: SET_ID, operation: 'CREATE', payload: setPayload }),
    );
    expect(repo.createWorkoutSet).toHaveBeenCalledWith(
      USER,
      SET_ID,
      expect.objectContaining({
        workoutLogId: LOG_ID,
        exerciseId: EX_ID,
        setNumber: 1,
        reps: 5,
      }),
    );
  });

  it('soft-deletes a set with the pipeline-provided next version', async () => {
    const h = new WorkoutSetSyncHandler(asPort(repo));
    await h.apply(
      USER,
      op({ entityId: SET_ID, operation: 'DELETE', baseVersion: 4 }),
    );
    expect(repo.softDeleteWorkoutSet).toHaveBeenCalledWith(SET_ID, USER, 5);
  });

  it('getServerState is owner-scoped', async () => {
    const h = new WorkoutSetSyncHandler(asPort(repo));
    repo.findOwnedWorkoutSet.mockResolvedValue(null);
    expect(await h.getServerState(OTHER, SET_ID)).toBeNull();
    expect(repo.findOwnedWorkoutSet).toHaveBeenCalledWith(OTHER, SET_ID);
  });
});

describe('workout handler registration', () => {
  it('registers all four workout entity handlers with distinct entity types', () => {
    const registry = new SyncEntityRegistry();
    const handlers = [
      new RoutineSyncHandler(asPort(repo)),
      new RoutineExerciseSyncHandler(asPort(repo)),
      new WorkoutLogSyncHandler(asPort(repo)),
      new WorkoutSetSyncHandler(asPort(repo)),
    ];
    for (const h of handlers) registry.register(h);

    for (const t of [
      'routines',
      'routine_exercises',
      'workout_logs',
      'workout_sets',
    ]) {
      expect(registry.get(t)?.entityType).toBe(t);
    }
  });
});
