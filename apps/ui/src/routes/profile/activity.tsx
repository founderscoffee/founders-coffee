import { createFileRoute } from '@tanstack/react-router';

import { ActivityPage } from '../../features/events/components/ActivityPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';

export const Route = createFileRoute('/profile/activity')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <ActivityPage locale={locale} markets={markets} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
