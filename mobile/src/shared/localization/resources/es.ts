import type { TranslationKey } from './en';

export const es = {
  'language.title': 'Idioma',
  'language.description': 'Elige el idioma que usa AppFitness.',
  'language.system': 'Idioma del dispositivo',
  'language.english': 'Inglés',
  'language.spanish': 'Español',
  'language.saveError': 'No se pudo guardar el idioma. Inténtalo de nuevo.',
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
} as const satisfies Record<TranslationKey, string>;
