import { createFileRoute } from '@tanstack/react-router';

import { notifications_title } from '@founders-coffee/i18n';

import { PreferencesPage } from '../../features/preferences/components/PreferencesPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

const NotificationsRoute = () => {
  const { locale, markets } = Route.useRouteContext();
  return <PreferencesPage locale={locale} markets={markets} />;
};

export const Route = createFileRoute('/$locale/profile/notifications')({
  beforeLoad: async ({ location, context }) => {
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: NotificationsRoute,
  head: ({ match }) =>
    privatePageHead(notifications_title({}, { locale: match.context.locale })),
});
