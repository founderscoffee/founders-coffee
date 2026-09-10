import { createFileRoute } from '@tanstack/react-router';

import { ActivityPage } from '../features/events/components/ActivityPage';

export const Route = createFileRoute('/activity')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <ActivityPage locale={locale} markets={markets} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
});
