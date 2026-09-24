import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { localizedCloseout } from '../lib/locale-routing';

export const Route = createFileRoute('/closeout/$eventId')({
  preload: false,
  beforeLoad: ({ params }) => {
    throw redirect(
      localizedCloseout(detectLocale(readCookieHeader()), params.eventId),
    );
  },
});
