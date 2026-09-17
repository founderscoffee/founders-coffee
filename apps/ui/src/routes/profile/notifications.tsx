import { createFileRoute } from '@tanstack/react-router';

import { notifications_title } from '@founders-coffee/i18n';

import { PreferencesPage } from '../../features/preferences/components/PreferencesPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/profile/notifications')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <PreferencesPage locale={locale} markets={markets} />;
  },
  head: ({ match }) =>
    privatePageHead(notifications_title({}, { locale: match.context.locale })),
});
