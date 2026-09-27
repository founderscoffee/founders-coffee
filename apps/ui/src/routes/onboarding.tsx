import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale } from '@founders-coffee/i18n';

import { readCookieHeader } from '../lib/cookies';
import { localizedOnboarding } from '../lib/locale-routing';
import {
  authReturnSearchSchema,
  withoutDefaultReturnPath,
} from '../lib/redirect';

export const Route = createFileRoute('/onboarding')({
  validateSearch: authReturnSearchSchema,
  search: { middlewares: [withoutDefaultReturnPath()] },
  beforeLoad: ({ search }) => {
    throw redirect({
      ...localizedOnboarding(detectLocale(readCookieHeader())),
      search,
    });
  },
});
