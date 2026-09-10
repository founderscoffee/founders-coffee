import { createFileRoute } from '@tanstack/react-router';

import { PreferencesPage } from '../features/preferences/components/PreferencesPage';

export const Route = createFileRoute('/preferences')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <PreferencesPage locale={locale} markets={markets} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
});
