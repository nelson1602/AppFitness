/**
 * Semantic color tokens per .ai/08_UI_UX.md (Material Design 3 roles).
 * Components must consume these via useTheme() — never raw hex values.
 */
export interface ColorTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  tertiary: string;
  onTertiary: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
  info: string;
  onInfo: string;
  disabled: string;
  onDisabled: string;
  outline: string;
  divider: string;
  accent: string;
}

export const lightColors: ColorTokens = {
  primary: '#208AEF',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D6E9FC',
  onPrimaryContainer: '#0A3D6B',
  secondary: '#4F6070',
  onSecondary: '#FFFFFF',
  tertiary: '#5E5A7D',
  onTertiary: '#FFFFFF',
  background: '#F8FAFC',
  onBackground: '#191C1F',
  surface: '#FFFFFF',
  onSurface: '#191C1F',
  surfaceVariant: '#EEF1F5',
  onSurfaceVariant: '#44474C',
  success: '#1B873F',
  onSuccess: '#FFFFFF',
  warning: '#B26A00',
  onWarning: '#FFFFFF',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  info: '#0B6BCB',
  onInfo: '#FFFFFF',
  disabled: '#C4C7CC',
  onDisabled: '#75787D',
  outline: '#74777D',
  divider: '#E1E4E9',
  accent: '#00A6A6',
};

export const darkColors: ColorTokens = {
  primary: '#8FC5F7',
  onPrimary: '#06345C',
  primaryContainer: '#0F4C82',
  onPrimaryContainer: '#D6E9FC',
  secondary: '#B7C7D8',
  onSecondary: '#22323F',
  tertiary: '#C7C2E9',
  onTertiary: '#302C4C',
  background: '#101416',
  onBackground: '#E1E3E6',
  surface: '#191C1F',
  onSurface: '#E1E3E6',
  surfaceVariant: '#24282C',
  onSurfaceVariant: '#C4C7CC',
  success: '#6FD48E',
  onSuccess: '#003916',
  warning: '#FFB95C',
  onWarning: '#4A2800',
  error: '#FFB4AB',
  onError: '#690005',
  info: '#8FC5F7',
  onInfo: '#06345C',
  disabled: '#3A3E43',
  onDisabled: '#8A8D92',
  outline: '#8E9195',
  divider: '#2C3034',
  accent: '#4DD0D0',
};
