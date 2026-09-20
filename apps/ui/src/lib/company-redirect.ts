import { redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from './cookies';
import { localizedLanding } from './locale-routing';

/** Send a short company path to its locale-prefixed canonical page. */
export const companyRedirect = (city: string) => (): never => {
  throw redirect(localizedLanding(detectLocale(readCookieHeader()), city));
};
