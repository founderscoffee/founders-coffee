import { createFileRoute } from '@tanstack/react-router';

import { ProfilePage } from '../../features/profile/components/ProfilePage';
import { NO_INDEX_VALUE } from '../../lib/indexation';

export const Route = createFileRoute('/profile/')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <ProfilePage locale={locale} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
