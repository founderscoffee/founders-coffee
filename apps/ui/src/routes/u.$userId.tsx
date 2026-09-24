import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { localizedPublicProfile } from '../lib/locale-routing';
import { hostedPaginationSearchSchema } from '../lib/public-pagination';

export const Route = createFileRoute('/u/$userId')({
  validateSearch: hostedPaginationSearchSchema,
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
