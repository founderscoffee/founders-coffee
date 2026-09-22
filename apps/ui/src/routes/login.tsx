import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { login_title } from '@founders-coffee/i18n';

import { LoginPage } from '../components/auth/LoginPage';
import { authApi } from '../features/auth/api';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';
import { redirectWhenSignedIn } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/login')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: ({ search }) => redirectWhenSignedIn(search.redirect),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { turnstileSiteKey, isTurnstileBypassed, hasSocial } =
      Route.useLoaderData();
    const { redirect } = Route.useSearch();
    return (
      <LoginPage
        locale={locale}
        turnstileSiteKey={turnstileSiteKey}
        isTurnstileBypassed={isTurnstileBypassed}
        hasSocial={hasSocial}
        redirect={redirect}
      />
    );
  },
  loader: () => authApi.getPublicAuthConfig(),
  head: ({ match }) =>
    privatePageHead(login_title({}, { locale: match.context.locale })),
});
