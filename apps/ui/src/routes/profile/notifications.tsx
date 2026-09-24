import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../../lib/cookies';
import { localizedProfileNotifications } from '../../lib/locale-routing';

export const Route = createFileRoute('/profile/notifications')({
  preload: false,
  beforeLoad: () => {
    throw redirect(
      localizedProfileNotifications(detectLocale(readCookieHeader())),
    );
  },
});
