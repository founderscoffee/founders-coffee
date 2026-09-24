import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../../lib/cookies';
import { localizedProfileActivity } from '../../lib/locale-routing';

export const Route = createFileRoute('/profile/activity')({
  preload: false,
  beforeLoad: () => {
    throw redirect(localizedProfileActivity(detectLocale(readCookieHeader())));
  },
});
