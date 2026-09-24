import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { sign_in } from '@founders-coffee/i18n';

import { LoginPage } from '../components/auth/LoginPage';
import { authApi } from '../features/auth/api';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { authReturnPathSchema } from '../lib/redirect';
import { redirectWhenSignedIn } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

const LoginRoute = () => {
  const { locale } = Route.useRouteContext();
  const { turnstileSiteKey, isTurnstileBypassed, hasSocial } =
    Route.useLoaderData();
  const { redirect: returnPath } = Route.useSearch();
  return (
    <LoginPage
      locale={locale}
      turnstileSiteKey={turnstileSiteKey}
      isTurnstileBypassed={isTurnstileBypassed}
      hasSocial={hasSocial}
      redirect={returnPath}
    />
  );
};

export const Route = createFileRoute('/$locale/login')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: async ({ search }) => {
    await redirectWhenSignedIn(search.redirect);
  },
  component: LoginRoute,
  loader: () => authApi.getPublicAuthConfig(),
  head: ({ match }) =>
    privatePageHead(sign_in({}, { locale: match.context.locale })),
});
