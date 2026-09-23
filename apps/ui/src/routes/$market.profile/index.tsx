import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, isLocale, profile_title } from '@founders-coffee/i18n';

import { ProfilePage } from '../../features/profile/components/ProfilePage';
import { readCookieHeader } from '../../lib/cookies';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { localizedProfile } from '../../lib/locale-routing';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/$market/profile/')({
  beforeLoad: async ({ params, location, context }) => {
    if (!isLocale(params.market))
      throw redirect(localizedProfile(detectLocale(readCookieHeader())));
    await requireSession(context.locale, location.href);
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <ProfilePage locale={locale} />;
  },
  head: ({ match }) =>
    privatePageHead(profile_title({}, { locale: match.context.locale })),
});
