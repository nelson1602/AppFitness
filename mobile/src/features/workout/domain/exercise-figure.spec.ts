import { demoMotionFor } from './exercise-demo';
import {
  FIGURE_STILL_PHASE,
  type FigureMotion,
  figureFor,
  figurePose,
  figurePropFor,
  limbPath,
} from './exercise-figure';

describe('exercise figure (prototype ExerciseDemo)', () => {
  it('eases from pose a to pose b and back over one cycle', () => {
    expect(figurePose('squat', 0).h).toEqual([60, 14]);
    expect(figurePose('squat', 0.5).h).toEqual([66, 38]);
    expect(figurePose('squat', 1).h[1]).toBeCloseTo(14);
  });

  it('holds the prototype first frame (t = 0.6 s) when still', () => {
    // k = (1 - cos(2π · 0.6 / 2.4)) / 2 = 0.5: halfway between the two poses.
    expect(figurePose('lunge', FIGURE_STILL_PHASE).p).toEqual([59, 61]);
  });

  it('pedals the bike on a circle of radius 9 around the crank', () => {
    const { f1, f2 } = figurePose('bike', 0.1);
    expect(Math.hypot(f1[0] - 60, f1[1] - 78)).toBeCloseTo(9);
    expect([f1[0] + f2[0], f1[1] + f2[1]]).toEqual([120, 156]);
  });

  it('draws each limb as a path through its joints', () => {
    expect(limbPath(figurePose('squat', 0), ['s', 'p'])).toBe('M60.0 27.0L60.0 54.0');
  });

  it('shows the props of the prototype', () => {
    expect(figurePropFor('bench')).toBe('bench');
    expect(figurePropFor('bike')).toBe('bike');
    expect(figurePropFor('squat')).toBeUndefined();
  });

  it('never shows a figure that does not match the exercise', () => {
    for (const key of [
      'exercise.leg_press',
      'exercise.push_up',
      'exercise.overhead_press',
      'exercise.lat_pulldown',
      'exercise.seated_cable_row',
      'exercise.skull_crusher',
      'exercise.steady_run',
      'exercise.box_jump',
      'exercise.cat_cow',
      'exercise.unknown',
    ]) {
      expect([key, figureFor(key)]).toEqual([key, null]);
    }
  });

  it('keeps the figure and the cues on the same movement', () => {
    const shown: [string, FigureMotion][] = [
      ['exercise.back_squat', 'squat'],
      ['exercise.romanian_deadlift', 'hinge'],
      ['exercise.bench_press', 'bench'],
      ['exercise.stationary_bike', 'bike'],
      ['exercise.brisk_walk', 'walk'],
    ];
    for (const [key, motion] of shown) {
      expect(figureFor(key)).toBe(motion);
      expect(demoMotionFor(key)).toBe(motion);
    }
  });
});
