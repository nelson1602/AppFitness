/**
 * Motion duration tokens per .ai/08_UI_UX.md (Fast / Normal / Slow).
 * Durations in milliseconds. No arbitrary animation timings in components.
 */
export const motion = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export type MotionToken = keyof typeof motion;
