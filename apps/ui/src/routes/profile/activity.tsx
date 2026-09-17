import { createFileRoute } from '@tanstack/react-router';

import { activity_title } from '@founders-coffee/i18n';

import { ActivityPage } from '../../features/events/components/ActivityPage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/profile/activity')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    return <ActivityPage locale={locale} markets={markets} />;
  },
  head: ({ match }) =>
    privatePageHead(activity_title({}, { locale: match.context.locale })),
});
