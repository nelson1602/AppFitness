import { matchExerciseExclusion } from './exercise-exclusion';
import { getBuiltInExercise } from '../infrastructure/exercise-catalog.data';

const backSquat = getBuiltInExercise('exercise.back_squat')!; // deep_squat, max_effort_lifts, valsalva_heavy_lifts
const plank = getBuiltInExercise('exercise.plank')!; // no movement patterns

describe('matchExerciseExclusion', () => {
  it('excludes a built-in whose movement pattern is in the plan excludedMovements', () => {
    const r = matchExerciseExclusion(backSquat, ['deep_squat', 'lunge']);
    expect(r.status).toBe('excluded');
    expect(r.isBuiltIn).toBe(true);
    expect(r.matchedMovements).toEqual(['deep_squat']);
  });

  it('reports every matching movement, sorted', () => {
    const r = matchExerciseExclusion(backSquat, [
      'valsalva_heavy_lifts',
      'deep_squat',
      'max_effort_lifts',
    ]);
    expect(r.status).toBe('excluded');
    expect(r.matchedMovements).toEqual(['deep_squat', 'max_effort_lifts', 'valsalva_heavy_lifts']);
  });

  it('allows a built-in when none of its patterns are excluded', () => {
    const r = matchExerciseExclusion(backSquat, ['overhead_press', 'running']);
    expect(r.status).toBe('allowed');
    expect(r.matchedMovements).toEqual([]);
    expect(r.isBuiltIn).toBe(true);
  });

  it('allows a built-in that has no movement patterns at all', () => {
    expect(matchExerciseExclusion(plank, ['deep_squat', 'heavy_hinge']).status).toBe('allowed');
  });

  it('treats a custom / unmapped exercise as neutral (never auto-excluded)', () => {
    // Even when the plan excludes movements, an unmapped exercise is neutral.
    const r = matchExerciseExclusion(null, ['deep_squat', 'heavy_hinge', 'running']);
    expect(r.status).toBe('neutral');
    expect(r.isBuiltIn).toBe(false);
    expect(r.matchedMovements).toEqual([]);
  });

  it('excludes nothing when the plan has no excluded movements (empty input)', () => {
    expect(matchExerciseExclusion(backSquat, []).status).toBe('allowed');
    expect(matchExerciseExclusion(plank, []).status).toBe('allowed');
    expect(matchExerciseExclusion(null, []).status).toBe('neutral');
  });

  it('is deterministic and side-effect free (same inputs → deep-equal output)', () => {
    const input = ['deep_squat', 'max_effort_lifts'];
    const a = matchExerciseExclusion(backSquat, input);
    const b = matchExerciseExclusion(backSquat, input);
    expect(a).toEqual(b);
    // Input is not mutated.
    expect(input).toEqual(['deep_squat', 'max_effort_lifts']);
  });

  it('only CONSUMES excludedMovements — it never recomputes/overrides restrictions', () => {
    // The exclusion depends SOLELY on the passed excludedMovements: with the
    // token absent the exercise is allowed, with it present excluded — the
    // module derives nothing itself (no restriction/medical recompute path).
    expect(matchExerciseExclusion(backSquat, []).status).toBe('allowed');
    expect(matchExerciseExclusion(backSquat, ['deep_squat']).status).toBe('excluded');
    // Passing an arbitrary token set is honored verbatim; medical caps
    // (blocked/rpeCap/intensity) are the engine's concern and are never read
    // or overridden here — this matcher's only input is the token list.
    expect(matchExerciseExclusion(backSquat, ['made_up_token']).status).toBe('allowed');
  });
});
