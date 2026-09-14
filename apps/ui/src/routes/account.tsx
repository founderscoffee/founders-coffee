import { createFileRoute } from '@tanstack/react-router';

import { AccountPage } from '../features/account/components/AccountPage';
import { NO_INDEX_VALUE } from '../lib/indexation';

export const Route = createFileRoute('/account')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <AccountPage locale={locale} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
