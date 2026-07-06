import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './colors';
import { elevations } from './elevation';
import { motion } from './motion';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  typography: typeof typography;
  radius: typeof radius;
  elevations: typeof elevations;
  motion: typeof motion;
}

const base = { spacing, typography, radius, elevations, motion };

export const lightTheme: Theme = { dark: false, colors: lightColors, ...base };
export const darkTheme: Theme = { dark: true, colors: darkColors, ...base };

/**
 * Resolves the active theme from the system color scheme.
 * All screens/components read design tokens through this hook.
 */
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? darkTheme : lightTheme);
