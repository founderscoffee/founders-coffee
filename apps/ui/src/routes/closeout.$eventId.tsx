import { createFileRoute } from '@tanstack/react-router';

import { CloseoutPage } from '../features/operations/components/CloseoutPage';

export const Route = createFileRoute('/closeout/$eventId')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { eventId } = Route.useParams();
    return <CloseoutPage locale={locale} eventId={eventId} />;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
});
