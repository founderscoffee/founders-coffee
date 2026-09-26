import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { onboarding_title } from '@founders-coffee/i18n';

import { OnboardingPage } from '../features/profile/components/OnboardingPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';
import { requireSession } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

const OnboardingRoute = () => {
  const { locale } = Route.useRouteContext();
  const { redirect: returnPath } = Route.useSearch();
  return <OnboardingPage locale={locale} redirect={returnPath} />;
};

export const Route = createFileRoute('/$locale/onboarding')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: async ({ search, context }) => {
    await requireSession(context.locale, search.redirect);
  },
  component: OnboardingRoute,
  head: ({ match }) =>
    privatePageHead(onboarding_title({}, { locale: match.context.locale })),
});
