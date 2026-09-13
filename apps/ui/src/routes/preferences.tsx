import { createFileRoute } from '@tanstack/react-router';

import { PreferencesPage } from '../features/preferences/components/PreferencesPage';
import { NO_INDEX_VALUE } from '../lib/indexation';

export const Route = createFileRoute('/preferences')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <PreferencesPage locale={locale} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: NO_INDEX_VALUE }] }),
});
