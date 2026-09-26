import { createFileRoute } from '@tanstack/react-router';

import { account } from '@founders-coffee/i18n';

import { AccountPage } from '../../features/account/components/AccountPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

const AccountRoute = () => {
  const { locale } = Route.useRouteContext();
  return <AccountPage locale={locale} />;
};

export const Route = createFileRoute('/$locale/profile/account')({
  beforeLoad: async ({ location, context }) => {
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: AccountRoute,
  head: ({ match }) =>
    privatePageHead(account({}, { locale: match.context.locale })),
});
