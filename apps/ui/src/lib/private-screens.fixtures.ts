import { LOCALES } from '@founders-coffee/i18n';

export const PRIVATE_SCREENS = [
  'login',
  'onboarding',
  'profile',
  'profile/account',
  'profile/activity',
  'profile/notifications',
  'u/usr_1',
  'closeout/evt_1',
  'feedback/evt_1',
  'edit/evt_1',
  'algeria/host/create',
];

export const PRIVATE_SCREENS_IN_EVERY_LANGUAGE = LOCALES.flatMap((locale) =>
  PRIVATE_SCREENS.map((screen) => `/${locale}/${screen}`),
);

export const PRIVATE_SCREEN_STUBS = [
  ...PRIVATE_SCREENS.map((screen) => `/${screen}`),
  '/account',
  '/activity',
  '/preferences',
];

export const PRIVATE_SCREEN_VARIANTS = [
  '/PROFILE',
  '/en/PROFILE',
  '/fr/Feedback/evt_1',
  '/algeria/profile',
  '/EN/profile',
  '/algeria/u/usr_1',
];

export const PUBLIC_PAGES_NAMING_A_SCREEN = [
  '/ar/algeria/profile',
  '/en/algeria/e/feedback',
  '/en/algeria/e/closeout',
  '/ar/algeria/e/edit',
  '/fr/algeria/e/login',
  '/en/algeria/e/profile',
  '/en/e/feedback',
];
