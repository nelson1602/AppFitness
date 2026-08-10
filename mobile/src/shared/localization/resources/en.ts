export const en = {
  'language.title': 'Language',
  'language.description': 'Choose the language used by AppFitness.',
  'language.system': 'Device language',
  'language.english': 'English',
  'language.spanish': 'Spanish',
  'language.saveError': 'Language preference could not be saved. Try again.',
  'auth.screenTitle': 'Sign in',
  'auth.subtitle': 'Sign in to continue.',
  'auth.email': 'Email',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.register': 'Register',
  'auth.useExistingAccount': 'Use existing account',
  'auth.createAccount': 'Create a local account',
  'auth.switchMode': 'Switch authentication mode',
  'auth.errorTitle': 'Sign-in error',
  'auth.errorMessage': 'Authentication failed. Check your credentials and connection.',
} as const;

export type TranslationKey = keyof typeof en;
