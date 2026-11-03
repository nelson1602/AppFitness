/**
 * "Ver cómo se hace" (prototype `ExerciseDemo`): every catalog exercise maps
 * to one movement type, and each type has three short cues. The prototype's
 * animated figure is not built yet; the cues carry the demonstration.
 */
export type DemoMotion =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'bridge'
  | 'abduct'
  | 'overhead'
  | 'bench'
  | 'pushup'
  | 'row'
  | 'pulldown'
  | 'plank'
  | 'rotation'
  | 'walk'
  | 'run'
  | 'bike'
  | 'jump'
  | 'carry'
  | 'dip'
  | 'mobility';

export const DEMO_MOTIONS: readonly DemoMotion[] = [
  'squat',
  'lunge',
  'hinge',
  'bridge',
  'abduct',
  'overhead',
  'bench',
  'pushup',
  'row',
  'pulldown',
  'plank',
  'rotation',
  'walk',
  'run',
  'bike',
  'jump',
  'carry',
  'dip',
  'mobility',
];

const MOTION_BY_EXERCISE: Readonly<Record<string, DemoMotion>> = {
  'exercise.back_squat': 'squat',
  'exercise.front_squat': 'squat',
  'exercise.goblet_squat': 'squat',
  'exercise.bodyweight_squat': 'squat',
  'exercise.leg_press': 'squat',
  'exercise.walking_lunge': 'lunge',
  'exercise.deadlift': 'hinge',
  'exercise.romanian_deadlift': 'hinge',
  'exercise.good_morning': 'hinge',
  'exercise.kettlebell_deadlift': 'hinge',
  'exercise.cable_pull_through': 'hinge',
  'exercise.glute_bridge': 'bridge',
  'exercise.band_hip_abduction': 'abduct',
  'exercise.overhead_press': 'overhead',
  'exercise.kettlebell_overhead_press': 'overhead',
  'exercise.bench_press': 'bench',
  'exercise.dumbbell_floor_press': 'bench',
  'exercise.machine_chest_press': 'bench',
  'exercise.skull_crusher': 'bench',
  'exercise.push_up': 'pushup',
  'exercise.seated_cable_row': 'row',
  'exercise.one_arm_dumbbell_row': 'row',
  'exercise.kettlebell_row': 'row',
  'exercise.bent_over_barbell_row': 'row',
  'exercise.prone_snow_angel': 'row',
  'exercise.lat_pulldown': 'pulldown',
  'exercise.band_lat_pulldown': 'pulldown',
  'exercise.plank': 'plank',
  'exercise.band_external_rotation': 'rotation',
  'exercise.brisk_walk': 'walk',
  'exercise.steady_run': 'run',
  'exercise.sprint_intervals': 'run',
  'exercise.stationary_bike': 'bike',
  'exercise.box_jump': 'jump',
  'exercise.farmers_carry': 'carry',
  'exercise.dips': 'dip',
  'exercise.cat_cow': 'mobility',
};

/** The movement type behind an exercise; unknown keys get gentle mobility cues. */
export function demoMotionFor(exerciseKey: string): DemoMotion {
  return MOTION_BY_EXERCISE[exerciseKey] ?? 'mobility';
}
