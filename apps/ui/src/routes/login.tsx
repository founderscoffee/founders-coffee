import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { LoginPage } from '../components/auth/LoginPage';
import { authApi } from '../features/auth/api';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/login')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { turnstileSiteKey, hasSocial } = Route.useLoaderData();
    const { redirect } = Route.useSearch();
    return (
      <LoginPage
        locale={locale}
        turnstileSiteKey={turnstileSiteKey}
        hasSocial={hasSocial}
        redirect={redirect}
      />
    );
  },
  loader: () => authApi.getPublicAuthConfig(),
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
