import { createFileRoute } from '@tanstack/react-router';

import { profile_title } from '@founders-coffee/i18n';

import { ProfilePage } from '../../features/profile/components/ProfilePage';
import { NO_INDEX_VALUE } from '../../lib/indexation';
import { requireSession } from '../../features/auth/require-session';
import { privatePageHead } from '../../lib/seo-private';

export const Route = createFileRoute('/profile/')({
  beforeLoad: ({ location, context }) =>
    requireSession(context.locale, location.href),
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
