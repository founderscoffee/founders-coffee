import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { localizedEventEdit } from '../lib/locale-routing';

export const Route = createFileRoute('/edit/$eventId')({
  beforeLoad: ({ params }) => {
    throw redirect(
      localizedEventEdit(detectLocale(readCookieHeader()), params.eventId),
    );
  },
});
