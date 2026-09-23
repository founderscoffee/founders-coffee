import { createFileRoute, redirect } from '@tanstack/react-router';

import {
  detectLocale,
  isLocale,
  notifications_title,
} from '@founders-coffee/i18n';

import { PreferencesPage } from '../../features/preferences/components/PreferencesPage';
import { readCookieHeader } from '../../lib/cookies';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { localizedProfileNotifications } from '../../lib/locale-routing';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/$market/profile/notifications')({
  beforeLoad: async ({ params, location, context }) => {
    if (!isLocale(params.market))
      throw redirect(
        localizedProfileNotifications(detectLocale(readCookieHeader())),
      );
    await requireSession(context.locale, location.href);
  },
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
