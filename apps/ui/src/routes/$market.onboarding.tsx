import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import {
  detectLocale,
  isLocale,
  onboarding_title,
} from '@founders-coffee/i18n';

import { OnboardingPage } from '../features/profile/components/OnboardingPage';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedOnboarding } from '../lib/locale-routing';
import { authReturnPathSchema } from '../lib/redirect';
import { requireSession } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$market/onboarding')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: async ({ params, search, context }) => {
    if (!isLocale(params.market))
      throw redirect({
        ...localizedOnboarding(detectLocale(readCookieHeader())),
        search,
      });
    await requireSession(context.locale, search.redirect);
  },
  component: () => {
    const { locale } = Route.useRouteContext();
    const { redirect: returnPath } = Route.useSearch();
    return <OnboardingPage locale={locale} redirect={returnPath} />;
  },
  head: ({ match }) =>
    privatePageHead(onboarding_title({}, { locale: match.context.locale })),
});
