import type { ViewStyle } from 'react-native';

/**
 * Elevation tokens (levels 0–5) per .ai/08_UI_UX.md.
 * Expressed as cross-platform shadow styles (elevation drives Android,
 * shadow* drives iOS).
 */
const level = (elevation: number, opacity: number, blur: number, y: number): ViewStyle => ({
  elevation,
  shadowColor: '#000000',
  shadowOpacity: opacity,
  shadowRadius: blur,
  shadowOffset: { width: 0, height: y },
});

export const elevations = {
  level0: level(0, 0, 0, 0),
  level1: level(1, 0.08, 2, 1),
  level2: level(2, 0.1, 4, 2),
  level3: level(3, 0.12, 8, 4),
  level4: level(4, 0.14, 12, 6),
  level5: level(5, 0.16, 16, 8),
} as const;

export type ElevationToken = keyof typeof elevations;
