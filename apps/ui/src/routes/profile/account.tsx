import { createFileRoute } from '@tanstack/react-router';

import { account_title } from '@founders-coffee/i18n';

import { AccountPage } from '../../features/account/components/AccountPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/profile/account')({
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
