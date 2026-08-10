import { render, screen } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const spanish = {
  'auth.screenTitle': 'Iniciar sesión',
  'auth.subtitle': 'Inicia sesión para continuar.',
  'auth.email': 'Correo electrónico',
  'auth.username': 'Nombre de usuario',
  'auth.password': 'Contraseña',
  'auth.signIn': 'Iniciar sesión',
  'auth.register': 'Registrarse',
  'auth.useExistingAccount': 'Usar una cuenta existente',
  'auth.createAccount': 'Crear una cuenta local',
  'auth.switchMode': 'Cambiar modo de autenticación',
  'auth.errorTitle': 'Error de inicio de sesión',
  'auth.errorMessage': 'No se pudo autenticar. Revisa tus credenciales y conexión.',
} as const;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { replace: jest.fn() },
}));
jest.mock('@/features/authentication', () => ({ signIn: jest.fn(), signUp: jest.fn() }));
jest.mock('@/shared/localization', () => ({
  LanguageSelector: () => null,
  useLocalization: () => ({
    t: (key: keyof typeof spanish) => spanish[key] ?? key,
  }),
}));

describe('SignInScreen localization proof surface', () => {
  it('renders the authentication surface in Spanish without changing field identities', async () => {
    await render(<SignInScreen />);

    expect(screen.getByText('Inicia sesión para continuar.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo electrónico')).toHaveProp('testID', 'input-email');
    expect(screen.getByLabelText('Contraseña')).toHaveProp('testID', 'input-password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeOnTheScreen();
  });
});
