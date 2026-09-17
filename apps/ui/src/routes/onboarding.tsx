import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { onboarding_title } from '@founders-coffee/i18n';

import { OnboardingPage } from '../features/profile/components/OnboardingPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/onboarding')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { redirect } = Route.useSearch();
    return <OnboardingPage locale={locale} redirect={redirect} />;
  },
  head: ({ match }) =>
    privatePageHead(onboarding_title({}, { locale: match.context.locale })),
});
