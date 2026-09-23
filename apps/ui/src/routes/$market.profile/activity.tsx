import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, isLocale, activity_title } from '@founders-coffee/i18n';

import { ActivityPage } from '../../features/events/components/ActivityPage';
import { readCookieHeader } from '../../lib/cookies';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { localizedProfileActivity } from '../../lib/locale-routing';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/$market/profile/activity')({
  beforeLoad: async ({ params, location, context }) => {
    if (!isLocale(params.market))
      throw redirect(
        localizedProfileActivity(detectLocale(readCookieHeader())),
      );
    await requireSession(context.locale, location.href);
  },
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
