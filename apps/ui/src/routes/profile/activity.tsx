import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../../lib/cookies';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { localizedProfileActivity } from '../../lib/locale-routing';

export const Route = createFileRoute('/profile/activity')({
  preload: false,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: () => {
    throw redirect(localizedProfileActivity(detectLocale(readCookieHeader())));
  },
});
