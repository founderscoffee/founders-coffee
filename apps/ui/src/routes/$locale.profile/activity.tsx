import { createFileRoute } from '@tanstack/react-router';

import { activity } from '@founders-coffee/i18n';

import { ActivityPage } from '../../features/events/components/ActivityPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

const ActivityRoute = () => {
  const { locale, markets } = Route.useRouteContext();
  return <ActivityPage locale={locale} markets={markets} />;
};

export const Route = createFileRoute('/$locale/profile/activity')({
  beforeLoad: async ({ location, context }) => {
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: ActivityRoute,
  head: ({ match }) =>
    privatePageHead(activity({}, { locale: match.context.locale })),
});
