import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { localizedOnboarding } from '../lib/locale-routing';
import { authReturnPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/onboarding')({
  preload: false,
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
