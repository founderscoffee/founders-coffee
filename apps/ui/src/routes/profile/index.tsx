import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../../lib/cookies';
import { localizedProfile } from '../../lib/locale-routing';

export const Route = createFileRoute('/profile/')({
  preload: false,
  beforeLoad: () => {
    throw redirect(localizedProfile(detectLocale(readCookieHeader())));
  },
});
