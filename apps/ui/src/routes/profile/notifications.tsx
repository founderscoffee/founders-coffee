import { createFileRoute } from '@tanstack/react-router';

import { PreferencesPage } from '../../features/preferences/components/PreferencesPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';

export const Route = createFileRoute('/profile/notifications')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <PreferencesPage locale={locale} markets={markets} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
