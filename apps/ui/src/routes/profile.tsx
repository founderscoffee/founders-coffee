import { createFileRoute } from '@tanstack/react-router';

import { ProfilePage } from '../features/profile/components/ProfilePage';

export const Route = createFileRoute('/profile')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    return <ProfilePage locale={locale} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
});
