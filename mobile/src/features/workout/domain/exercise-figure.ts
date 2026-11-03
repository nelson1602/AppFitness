/**
 * The animated figure of "Ver cómo se hace" (prototype `ExerciseDemo`,
 * docs/design/appfitnessrd-prototipo.html). Each movement has two poses in a
 * 120×100 box; the figure eases a→b→a with a cosine over 2.4 s. The bike pedals
 * on a circle instead. Pose tables are copied verbatim from the prototype.
 */
export type Point = readonly [number, number];
export type Joint = 'h' | 's' | 'p' | 'e1' | 'w1' | 'e2' | 'w2' | 'k1' | 'f1' | 'k2' | 'f2';
export type Pose = Readonly<Record<Joint, Point>>;
export type FigureProp = 'bench' | 'seat' | 'box' | 'bike';

export type FigureMotion =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'bridge'
  | 'calf'
  | 'abduct'
  | 'overhead'
  | 'bench'
  | 'pushup'
  | 'row'
  | 'pulldown'
  | 'plank'
  | 'birddog'
  | 'deadbug'
  | 'rotation'
  | 'walk'
  | 'bike';

interface PoseMotion {
  prop?: FigureProp;
  a: Pose;
  b: Pose;
}

/** One full a→b→a cycle; the bike turns twice per cycle (1.2 s a turn). */
export const FIGURE_CYCLE_MS = 2400;
/** The prototype's first frame (t = 0.6 s), shown still under reduced motion. */
export const FIGURE_STILL_PHASE = 0.25;

const STAND: Pose = {
  h: [60, 14],
  s: [60, 27],
  p: [60, 54],
  e1: [62, 41],
  w1: [63, 54],
  e2: [58, 41],
  w2: [57, 54],
  k1: [62, 73],
  f1: [62, 92],
  k2: [58, 73],
  f2: [58, 92],
};

// prettier-ignore
const POSE_MOTIONS: Readonly<Record<Exclude<FigureMotion, 'bike'>, PoseMotion>> = {
  squat: { a: { ...STAND, e1: [68, 34], w1: [66, 28], e2: [66, 34], w2: [64, 28] }, b: { h: [66, 38], s: [64, 49], p: [48, 68], e1: [72, 54], w1: [71, 47], e2: [70, 54], w2: [69, 47], k1: [70, 72], f1: [62, 92], k2: [68, 73], f2: [58, 92] } },
  lunge: { a: STAND, b: { h: [58, 30], s: [58, 43], p: [58, 68], e1: [60, 56], w1: [61, 68], e2: [56, 56], w2: [55, 68], k1: [76, 70], f1: [78, 92], k2: [52, 88], f2: [38, 92] } },
  hinge: { a: STAND, b: { h: [86, 36], s: [78, 38], p: [54, 54], e1: [78, 52], w1: [78, 66], e2: [76, 52], w2: [76, 66], k1: [62, 73], f1: [60, 92], k2: [58, 73], f2: [56, 92] } },
  bridge: { a: { h: [18, 84], s: [28, 84], p: [54, 86], e1: [36, 89], w1: [46, 90], e2: [35, 89], w2: [45, 90], k1: [72, 68], f1: [80, 91], k2: [70, 68], f2: [78, 91] }, b: { h: [18, 84], s: [29, 82], p: [56, 68], e1: [36, 89], w1: [46, 90], e2: [35, 89], w2: [45, 90], k1: [74, 64], f1: [80, 91], k2: [72, 64], f2: [78, 91] } },
  calf: { a: STAND, b: { ...STAND, h: [60, 9], s: [60, 22], p: [60, 49], e1: [62, 36], w1: [63, 49], e2: [58, 36], w2: [57, 49], k1: [62, 68], k2: [58, 68] } },
  abduct: { a: STAND, b: { ...STAND, k2: [52, 72], f2: [42, 90] } },
  overhead: { prop: 'seat', a: { h: [56, 30], s: [56, 42], p: [56, 66], e1: [68, 44], w1: [68, 33], e2: [66, 44], w2: [66, 33], k1: [76, 66], f1: [76, 90], k2: [74, 66], f2: [74, 90] }, b: { h: [56, 30], s: [56, 42], p: [56, 66], e1: [64, 28], w1: [62, 16], e2: [62, 28], w2: [60, 16], k1: [76, 66], f1: [76, 90], k2: [74, 66], f2: [74, 90] } },
  bench: { prop: 'bench', a: { h: [24, 58], s: [34, 59], p: [62, 60], e1: [36, 70], w1: [42, 56], e2: [34, 70], w2: [40, 56], k1: [76, 62], f1: [80, 90], k2: [74, 62], f2: [78, 90] }, b: { h: [24, 58], s: [34, 59], p: [62, 60], e1: [40, 46], w1: [40, 32], e2: [38, 46], w2: [38, 32], k1: [76, 62], f1: [80, 90], k2: [74, 62], f2: [78, 90] } },
  pushup: { prop: 'box', a: { h: [88, 38], s: [80, 43], p: [50, 62], e1: [82, 54], w1: [86, 64], e2: [80, 54], w2: [84, 64], k1: [36, 76], f1: [22, 90], k2: [34, 76], f2: [20, 90] }, b: { h: [92, 48], s: [83, 53], p: [52, 68], e1: [74, 56], w1: [86, 64], e2: [72, 56], w2: [84, 64], k1: [36, 78], f1: [22, 90], k2: [34, 78], f2: [20, 90] } },
  row: { a: { h: [82, 30], s: [74, 34], p: [52, 52], e1: [74, 48], w1: [74, 62], e2: [72, 48], w2: [72, 62], k1: [60, 72], f1: [58, 92], k2: [56, 72], f2: [52, 92] }, b: { h: [82, 30], s: [74, 34], p: [52, 52], e1: [62, 38], w1: [68, 50], e2: [60, 38], w2: [66, 50], k1: [60, 72], f1: [58, 92], k2: [56, 72], f2: [52, 92] } },
  pulldown: { a: { ...STAND, e1: [64, 12], w1: [66, 2], e2: [58, 12], w2: [56, 2] }, b: { ...STAND, e1: [72, 32], w1: [68, 22], e2: [50, 32], w2: [54, 22] } },
  plank: { a: { h: [92, 66], s: [84, 68], p: [52, 72], e1: [84, 90], w1: [96, 90], e2: [82, 90], w2: [94, 90], k1: [36, 80], f1: [20, 90], k2: [34, 80], f2: [18, 90] }, b: { h: [92, 65], s: [84, 67], p: [52, 70], e1: [84, 90], w1: [96, 90], e2: [82, 90], w2: [94, 90], k1: [36, 79], f1: [20, 90], k2: [34, 79], f2: [18, 90] } },
  birddog: { a: { h: [86, 52], s: [78, 56], p: [46, 56], e1: [78, 73], w1: [78, 90], e2: [76, 73], w2: [76, 90], k1: [46, 90], f1: [30, 90], k2: [44, 90], f2: [28, 90] }, b: { h: [86, 52], s: [78, 56], p: [46, 56], e1: [90, 54], w1: [103, 52], e2: [76, 73], w2: [76, 90], k1: [46, 90], f1: [30, 90], k2: [30, 56], f2: [14, 56] } },
  deadbug: { a: { h: [18, 86], s: [28, 86], p: [54, 88], e1: [30, 72], w1: [30, 58], e2: [29, 72], w2: [29, 58], k1: [54, 68], f1: [70, 68], k2: [53, 68], f2: [69, 68] }, b: { h: [18, 86], s: [28, 86], p: [54, 88], e1: [20, 76], w1: [8, 80], e2: [29, 72], w2: [29, 58], k1: [54, 68], f1: [70, 68], k2: [70, 82], f2: [88, 86] } },
  rotation: { a: { ...STAND, e1: [62, 41], w1: [74, 42], e2: [58, 41], w2: [70, 42] }, b: { ...STAND, e1: [62, 41], w1: [66, 30], e2: [58, 41], w2: [62, 30] } },
  walk: { a: { ...STAND, e1: [54, 40], w1: [50, 50], e2: [66, 40], w2: [72, 48], k1: [66, 72], f1: [72, 91], k2: [56, 73], f2: [48, 91] }, b: { ...STAND, e1: [66, 40], w1: [72, 48], e2: [54, 40], w2: [50, 50], k1: [56, 73], f1: [48, 91], k2: [66, 72], f2: [72, 91] } },
};

/**
 * Catalog exercises whose movement the figure really shows. The prototype maps
 * Spanish names with a `walk` fallback; the app maps keys and has no fallback,
 * so an exercise the figure would misrepresent shows its cues only. Left out on
 * purpose: leg press, machine and floor presses, skull crusher (lying press
 * figure on a bench), floor push-up (the figure is incline on a box), standing
 * overhead presses (the figure is seated), seated and machine pulls (the
 * figure stands), snow angel, run, jumps, carries, dips and mobility.
 */
const FIGURE_BY_EXERCISE: Readonly<Record<string, FigureMotion>> = {
  'exercise.back_squat': 'squat',
  'exercise.front_squat': 'squat',
  'exercise.goblet_squat': 'squat',
  'exercise.bodyweight_squat': 'squat',
  'exercise.walking_lunge': 'lunge',
  'exercise.deadlift': 'hinge',
  'exercise.romanian_deadlift': 'hinge',
  'exercise.good_morning': 'hinge',
  'exercise.kettlebell_deadlift': 'hinge',
  'exercise.cable_pull_through': 'hinge',
  'exercise.glute_bridge': 'bridge',
  'exercise.band_hip_abduction': 'abduct',
  'exercise.bench_press': 'bench',
  'exercise.bent_over_barbell_row': 'row',
  'exercise.one_arm_dumbbell_row': 'row',
  'exercise.kettlebell_row': 'row',
  'exercise.band_lat_pulldown': 'pulldown',
  'exercise.plank': 'plank',
  'exercise.band_external_rotation': 'rotation',
  'exercise.brisk_walk': 'walk',
  'exercise.stationary_bike': 'bike',
};

/** The figure for an exercise, or null when only the cues should show. */
export function figureFor(exerciseKey: string): FigureMotion | null {
  return FIGURE_BY_EXERCISE[exerciseKey] ?? null;
}

/** The prop drawn behind the figure, if any. */
export function figurePropFor(motion: FigureMotion): FigureProp | undefined {
  return motion === 'bike' ? 'bike' : POSE_MOTIONS[motion].prop;
}

/**
 * The figure's joints at a phase of the cycle (0–1). Runs on the UI thread
 * (Reanimated worklet) and in plain JS.
 */
export function figurePose(motion: FigureMotion, phase: number): Pose {
  'worklet';
  if (motion === 'bike') {
    const ang = phase * Math.PI * 4;
    const r = 9;
    const f1: Point = [60 + r * Math.cos(ang), 78 + r * Math.sin(ang)];
    const f2: Point = [60 - r * Math.cos(ang), 78 - r * Math.sin(ang)];
    const p: Point = [46, 56];
    const knee = (f: Point): Point => [(p[0] + f[0]) / 2 + 7, (p[1] + f[1]) / 2 - 7];
    return {
      h: [54, 20],
      s: [56, 33],
      p,
      e1: [66, 42],
      w1: [76, 46],
      e2: [64, 42],
      w2: [74, 46],
      k1: knee(f1),
      f1,
      k2: knee(f2),
      f2,
    };
  }
  const { a, b } = POSE_MOTIONS[motion];
  const k = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const at = (joint: Joint): Point => [
    a[joint][0] + (b[joint][0] - a[joint][0]) * k,
    a[joint][1] + (b[joint][1] - a[joint][1]) * k,
  ];
  return {
    h: at('h'),
    s: at('s'),
    p: at('p'),
    e1: at('e1'),
    w1: at('w1'),
    e2: at('e2'),
    w2: at('w2'),
    k1: at('k1'),
    f1: at('f1'),
    k2: at('k2'),
    f2: at('f2'),
  };
}

/** An SVG path through the given joints of a pose (the prototype's polylines). */
export function limbPath(pose: Pose, joints: readonly Joint[]): string {
  'worklet';
  let d = '';
  for (let i = 0; i < joints.length; i += 1) {
    const [x, y] = pose[joints[i] as Joint];
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
