import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { LoginPage } from '../components/auth/LoginPage';
import { authApi } from '../features/auth/api';
import { authReturnPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/login')({
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
});
