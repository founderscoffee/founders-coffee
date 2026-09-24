import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../../lib/cookies';
import { localizedProfileAccount } from '../../lib/locale-routing';

export const Route = createFileRoute('/profile/account')({
  preload: false,
  beforeLoad: () => {
    throw redirect(localizedProfileAccount(detectLocale(readCookieHeader())));
  },
});
