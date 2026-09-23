import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedPublicProfile } from '../lib/locale-routing';
import { hostedPaginationSearchSchema } from '../lib/public-pagination';

export const Route = createFileRoute('/u/$userId')({
  preload: false,
  validateSearch: hostedPaginationSearchSchema,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      ...localizedPublicProfile(
        detectLocale(readCookieHeader()),
        params.userId,
      ),
      search,
    });
  },
});
