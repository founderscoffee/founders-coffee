import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedOnboarding } from '../lib/locale-routing';
import { authReturnPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/onboarding')({
  preload: false,
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      ...localizedOnboarding(detectLocale(readCookieHeader())),
      search,
    });
  },
});
