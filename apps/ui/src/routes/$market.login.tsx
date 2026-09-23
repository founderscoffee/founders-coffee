import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { detectLocale, isLocale, login_title } from '@founders-coffee/i18n';

import { LoginPage } from '../components/auth/LoginPage';
import { authApi } from '../features/auth/api';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedLogin } from '../lib/locale-routing';
import { authReturnPathSchema } from '../lib/redirect';
import { redirectWhenSignedIn } from '../features/auth/require-session';
import { privatePageHead } from '../lib/seo-private';

export const Route = createFileRoute('/$market/login')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    redirect: authReturnPathSchema.catch('/').optional().default('/'),
  }),
  beforeLoad: async ({ params, search }) => {
    if (!isLocale(params.market))
      throw redirect({
        ...localizedLogin(detectLocale(readCookieHeader())),
        search,
      });
    await redirectWhenSignedIn(search.redirect);
  },
  component: () => {
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
  },
  loader: () => authApi.getPublicAuthConfig(),
  head: ({ match }) =>
    privatePageHead(login_title({}, { locale: match.context.locale })),
});
