import type { TranslationKey } from '@/shared/localization';

import type { CountryCode } from '../domain/country';

/** The localized name of each country on the picker (ES/EN, v8.1). */
export const COUNTRY_LABEL_KEY: Readonly<Record<CountryCode, TranslationKey>> = {
  DO: 'profile.country.do',
  AR: 'profile.country.ar',
  BO: 'profile.country.bo',
  CL: 'profile.country.cl',
  CO: 'profile.country.co',
  CR: 'profile.country.cr',
  CU: 'profile.country.cu',
  EC: 'profile.country.ec',
  SV: 'profile.country.sv',
  GT: 'profile.country.gt',
  HN: 'profile.country.hn',
  MX: 'profile.country.mx',
  NI: 'profile.country.ni',
  PA: 'profile.country.pa',
  PY: 'profile.country.py',
  PE: 'profile.country.pe',
  PR: 'profile.country.pr',
  UY: 'profile.country.uy',
  VE: 'profile.country.ve',
  US: 'profile.country.us',
  ES: 'profile.country.es',
  ZZ: 'profile.country.zz',
};
