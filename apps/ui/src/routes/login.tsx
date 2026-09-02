import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { getPublicAuthConfig } from '@founders-coffee/server-fns';

import { LoginPage } from '../components/auth/LoginPage';
import { sameOriginPathSchema } from '../lib/redirect';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: sameOriginPathSchema.catch('/').optional().default('/'),
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
  loader: () => getPublicAuthConfig(),
});
