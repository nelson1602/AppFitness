import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme-definition';

export { darkTheme, lightTheme, type Theme } from './theme-definition';

/**
 * Resolves the active theme from the system color scheme.
 * All screens/components read design tokens through this hook.
 */
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? darkTheme : lightTheme);
