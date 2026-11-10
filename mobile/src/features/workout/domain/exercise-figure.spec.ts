import { BUILT_IN_EXERCISES } from '../infrastructure/exercise-catalog.data';
import { demoMotionFor } from './exercise-demo';
import {
  FIGURE_STILL_PHASE,
  figureCarriesLoad,
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

  it('shows a figure for every library exercise (v10 Block C, item 11: 21 → 37 of 37)', () => {
    const missing = BUILT_IN_EXERCISES.map((e) => e.key).filter((key) => figureFor(key) === null);
    expect(missing).toEqual([]);
    expect(BUILT_IN_EXERCISES).toHaveLength(37);
  });

  it('still shows no figure for an exercise it does not know', () => {
    expect(figureFor('exercise.unknown')).toBeNull();
  });

  it('keeps every joint of every figure inside its 120×100 box', () => {
    const motions = [...new Set(BUILT_IN_EXERCISES.map((e) => figureFor(e.key)))];
    for (const motion of motions) {
      if (motion === null) continue;
      for (let i = 0; i <= 20; i += 1) {
        for (const [joint, [x, y]] of Object.entries(figurePose(motion, i / 20))) {
          expect([motion, joint, x >= 0 && x <= 120 && y >= 0 && y <= 100]).toEqual([
            motion,
            joint,
            true,
          ]);
        }
      }
    }
  });

  it('keeps the spine straight unless the movement arches it (cat-cow)', () => {
    const squat = figurePose('squat', 0);
    expect(squat.m).toEqual([(squat.s[0] + squat.p[0]) / 2, (squat.s[1] + squat.p[1]) / 2]);
    // Cat: the mid-back rises above the shoulder–hip line; cow: it sags below it.
    const cat = figurePose('catCow', 0);
    const cow = figurePose('catCow', 0.5);
    expect(cat.m[1]).toBeLessThan(cat.s[1]);
    expect(cow.m[1]).toBeGreaterThan(cow.s[1]);
    expect(cat.h[1]).toBeGreaterThan(cow.h[1]);
  });

  it('never lets the box jump pass through the box', () => {
    // lowBox: x 83–111, top at y 80.
    for (let i = 0; i <= 40; i += 1) {
      const { f1, f2 } = figurePose('boxJump', i / 40);
      for (const [x, y] of [f1, f2]) expect(x >= 83 && y > 80).toBe(false);
    }
    // Pose b lands on top of the box: both feet over it, standing on its top edge.
    const landed = figurePose('boxJump', 0.5);
    for (const [x, y] of [landed.f1, landed.f2]) {
      expect(x).toBeGreaterThanOrEqual(83);
      expect(x).toBeLessThanOrEqual(111);
      expect(y).toBeCloseTo(77, 0);
    }
  });

  it('puts a weight in each hand only for the carry', () => {
    expect(figureCarriesLoad('carry')).toBe(true);
    expect(figureCarriesLoad('walk')).toBe(false);
    expect(figureCarriesLoad('bike')).toBe(false);
  });

  it('draws the props of the new movements', () => {
    expect(figurePropFor('dip')).toBe('bars');
    expect(figurePropFor('seatedRow')).toBe('rowSeat');
    expect(figurePropFor('boxJump')).toBe('lowBox');
    expect(figurePropFor('legPress')).toBe('legPress');
    expect(figurePropFor('machinePress')).toBe('seat');
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
