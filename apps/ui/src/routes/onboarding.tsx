import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { OnboardingPage } from '../features/profile/components/OnboardingPage';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';

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
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
