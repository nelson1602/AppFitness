import { render, screen } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const spanish = {
  'auth.screenTitle': 'Iniciar sesión',
  'auth.headline': 'Cada latido cuenta.',
  'auth.headlineLead': 'Cada latido',
  'auth.headlineAccent': 'cuenta.',
  'auth.subtitle': 'Inicia sesión y sigue hacia tu meta.',
  'auth.forgotPassword': '¿Olvidaste tu contraseña?',
  'auth.forgotPasswordShort': '¿La olvidaste?',
  'auth.newHere': '¿Nuevo aquí?',
  'auth.showPassword': 'Mostrar contraseña',
  'brand.name': 'AppFitnessRD',
  'auth.email': 'Correo electrónico',
  'auth.username': 'Nombre de usuario',
  'auth.password': 'Contraseña',
  'auth.signIn': 'Iniciar sesión',
  'auth.register': 'Registrarse',
  'auth.useExistingAccount': 'Usar una cuenta existente',
  'auth.createAccount': 'Crea una cuenta',
  'auth.errorTitle': 'Error de inicio de sesión',
  'auth.errorMessage': 'No se pudo autenticar. Revisa tus credenciales y conexión.',
} as const;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn() },
}));
jest.mock('@/features/authentication', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  // ADR-P036: signed out, no biometrics on this test device.
  useSession: () => ({ status: 'unauthenticated', session: null }),
  useBiometricCapability: () => null,
  BiometricLinkSheet: () => null,
  unlockWithBiometrics: jest.fn(),
}));
jest.mock('@/shared/localization', () => ({
  LanguageSelector: () => null,
  useLocalization: () => ({
    t: (key: keyof typeof spanish) => spanish[key] ?? key,
  }),
}));

describe('SignInScreen localization proof surface', () => {
  it('renders the authentication surface in Spanish without changing field identities', async () => {
    await render(<SignInScreen />);

    expect(screen.getByRole('header', { name: 'Cada latido cuenta.' })).toBeOnTheScreen();
    expect(screen.getByText('Inicia sesión y sigue hacia tu meta.')).toBeOnTheScreen();
    expect(screen.getByText('¿Nuevo aquí?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toHaveTextContent(
      '¿La olvidaste?',
    );
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo electrónico')).toHaveProp('testID', 'input-email');
    expect(screen.getByLabelText('Contraseña')).toHaveProp('testID', 'input-password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Crea una cuenta' })).toBeOnTheScreen();
  });
});
