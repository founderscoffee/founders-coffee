import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, isLocale, account_title } from '@founders-coffee/i18n';

import { AccountPage } from '../../features/account/components/AccountPage';
import { readCookieHeader } from '../../lib/cookies';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { localizedProfileAccount } from '../../lib/locale-routing';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/$market/profile/account')({
  beforeLoad: async ({ params, location, context }) => {
    if (!isLocale(params.market))
      throw redirect(localizedProfileAccount(detectLocale(readCookieHeader())));
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <AccountPage locale={locale} />;
  },
  head: ({ match }) =>
    privatePageHead(account_title({}, { locale: match.context.locale })),
});
