import type { TranslationKey } from '@/shared/localization';

import type { DemoMotion } from '../domain/exercise-demo';

/** The three cues of each movement type, in order ("Ver cómo se hace"). */
export const DEMO_CUE_KEYS: Readonly<Record<DemoMotion, readonly TranslationKey[]>> = {
  squat: ['workout.demo.squat.cue1', 'workout.demo.squat.cue2', 'workout.demo.squat.cue3'],
  lunge: ['workout.demo.lunge.cue1', 'workout.demo.lunge.cue2', 'workout.demo.lunge.cue3'],
  hinge: ['workout.demo.hinge.cue1', 'workout.demo.hinge.cue2', 'workout.demo.hinge.cue3'],
  bridge: ['workout.demo.bridge.cue1', 'workout.demo.bridge.cue2', 'workout.demo.bridge.cue3'],
  abduct: ['workout.demo.abduct.cue1', 'workout.demo.abduct.cue2', 'workout.demo.abduct.cue3'],
  overhead: [
    'workout.demo.overhead.cue1',
    'workout.demo.overhead.cue2',
    'workout.demo.overhead.cue3',
  ],
  bench: ['workout.demo.bench.cue1', 'workout.demo.bench.cue2', 'workout.demo.bench.cue3'],
  pushup: ['workout.demo.pushup.cue1', 'workout.demo.pushup.cue2', 'workout.demo.pushup.cue3'],
  row: ['workout.demo.row.cue1', 'workout.demo.row.cue2', 'workout.demo.row.cue3'],
  pulldown: [
    'workout.demo.pulldown.cue1',
    'workout.demo.pulldown.cue2',
    'workout.demo.pulldown.cue3',
  ],
  plank: ['workout.demo.plank.cue1', 'workout.demo.plank.cue2', 'workout.demo.plank.cue3'],
  rotation: [
    'workout.demo.rotation.cue1',
    'workout.demo.rotation.cue2',
    'workout.demo.rotation.cue3',
  ],
  walk: ['workout.demo.walk.cue1', 'workout.demo.walk.cue2', 'workout.demo.walk.cue3'],
  run: ['workout.demo.run.cue1', 'workout.demo.run.cue2', 'workout.demo.run.cue3'],
  bike: ['workout.demo.bike.cue1', 'workout.demo.bike.cue2', 'workout.demo.bike.cue3'],
  jump: ['workout.demo.jump.cue1', 'workout.demo.jump.cue2', 'workout.demo.jump.cue3'],
  carry: ['workout.demo.carry.cue1', 'workout.demo.carry.cue2', 'workout.demo.carry.cue3'],
  dip: ['workout.demo.dip.cue1', 'workout.demo.dip.cue2', 'workout.demo.dip.cue3'],
  mobility: [
    'workout.demo.mobility.cue1',
    'workout.demo.mobility.cue2',
    'workout.demo.mobility.cue3',
  ],
};
