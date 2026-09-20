import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedFeedback } from '../lib/locale-routing';

export const Route = createFileRoute('/feedback/$eventId')({
  preload: false,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: ({ params }) => {
    throw redirect(
      localizedFeedback(detectLocale(readCookieHeader()), params.eventId),
    );
  },
});
