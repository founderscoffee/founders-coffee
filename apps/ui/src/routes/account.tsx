import { createFileRoute } from '@tanstack/react-router';

import { AccountPage } from '../features/account/components/AccountPage';

export const Route = createFileRoute('/account')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <AccountPage locale={locale} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
});
